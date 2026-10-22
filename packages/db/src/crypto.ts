import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const LEGACY_DEFAULT_KEY_ID = "default";

function decodeKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) {
    throw new Error(
      `Encryption key must decode to 32 bytes for AES-256-GCM, got ${key.length}`,
    );
  }
  return key;
}

/**
 * Where the raw key bytes come from. `EnvKeyProvider` reads base64 env
 * var(s) directly; swap in a cloud-KMS-backed implementation (envelope
 * decryption via KMS Decrypt) in production without touching callers.
 *
 * `getCurrentKeyId`/`getKeyById` support key rotation (F1 spec):
 * `encryptField` tags every new ciphertext with `getCurrentKeyId()`, and
 * `decryptField` looks the embedded id up via `getKeyById` so ciphertext
 * written under a retired key keeps decrypting after rotation — see
 * worker/jobs/reencrypt.ts, the one-off job that re-writes existing rows
 * under the new current key. Callers that only ever use a single key
 * (hmacLookup) can ignore these two methods.
 */
export interface KeyProvider {
  getKey(): Buffer;
  getCurrentKeyId(): string;
  getKeyById(keyId: string): Buffer;
}

export class EnvKeyProvider implements KeyProvider {
  private readonly keys: Map<string, Buffer>;
  private readonly currentKeyId: string;

  /**
   * Either a single base64 key (the common case — HMAC keys, or an
   * encryption key that's never been rotated) or a `{keyId: base64Key}`
   * map plus which id is current. The single-key form is tagged
   * "default" internally; it never appears in storage unless
   * `encryptField` was called before this field ever had a real key id.
   */
  constructor(
    keyOrKeys: string | Record<string, string>,
    currentKeyId?: string,
  ) {
    if (typeof keyOrKeys === "string") {
      this.keys = new Map([[LEGACY_DEFAULT_KEY_ID, decodeKey(keyOrKeys)]]);
      this.currentKeyId = LEGACY_DEFAULT_KEY_ID;
      return;
    }

    this.keys = new Map(
      Object.entries(keyOrKeys).map(([id, base64Key]) => [
        id,
        decodeKey(base64Key),
      ]),
    );
    if (!currentKeyId) {
      throw new Error(
        "EnvKeyProvider: currentKeyId is required when constructed with a key map",
      );
    }
    if (!this.keys.has(currentKeyId)) {
      throw new Error(
        `EnvKeyProvider: current key id "${currentKeyId}" not found among provided keys`,
      );
    }
    this.currentKeyId = currentKeyId;
  }

  getKey(): Buffer {
    return this.getKeyById(this.currentKeyId);
  }

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  getKeyById(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`EnvKeyProvider: no key registered for id "${keyId}"`);
    }
    return key;
  }
}

/**
 * AES-256-GCM encrypt. Output packs the encrypting key's id, iv, auth tag
 * and ciphertext as "."-joined segments (`keyId.iv.tag.ciphertext`) so a
 * later key rotation can still decrypt values written under a retired key —
 * see KeyProvider's doc comment.
 */
export function encryptField(plaintext: string, provider: KeyProvider): string {
  const key = provider.getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    provider.getCurrentKeyId(),
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

/**
 * Decrypts a value produced by encryptField, using the key id embedded in
 * the value (falling back to the provider's current key for values written
 * before key ids existed — plain `iv.tag.ciphertext`, 3 segments). Throws if
 * the ciphertext or auth tag has been tampered with (GCM authentication
 * failure), or if no key is registered for the embedded id.
 */
export function decryptField(packed: string, provider: KeyProvider): string {
  const parts = packed.split(".");

  let keyId: string;
  let ivB64: string | undefined;
  let authTagB64: string | undefined;
  let ciphertextB64: string | undefined;

  if (parts.length === 4) {
    [keyId, ivB64, authTagB64, ciphertextB64] = parts as [
      string,
      string,
      string,
      string,
    ];
  } else if (parts.length === 3) {
    keyId = provider.getCurrentKeyId();
    [ivB64, authTagB64, ciphertextB64] = parts as [string, string, string];
  } else {
    throw new Error(
      "Malformed encrypted field: expected keyId.iv.tag.ciphertext (or legacy iv.tag.ciphertext)",
    );
  }
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error(
      "Malformed encrypted field: expected keyId.iv.tag.ciphertext (or legacy iv.tag.ciphertext)",
    );
  }

  const key = provider.getKeyById(keyId);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Keyed HMAC-SHA256 for equality-lookup hashes (phone_hash, email_hash,
 * ip_hash) — deterministic, so two encryptions of the same value can be
 * found by WHERE equality without decrypting every row. Not subject to key
 * rotation (always uses the provider's current key) — rotating a lookup key
 * would silently break every existing equality match.
 */
export function hmacLookup(value: string, provider: KeyProvider): string {
  return createHmac("sha256", provider.getKey())
    .update(value, "utf8")
    .digest("hex");
}

/**
 * Plain (unkeyed) SHA-256 hex digest — for values that are already
 * high-entropy random tokens (e.g. the 32-byte share-link token), where a
 * keyed HMAC buys nothing over a straight hash. Never use this for
 * low-entropy values like phone numbers (use hmacLookup, which resists
 * rainbow-table/dictionary attacks via the secret key).
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
