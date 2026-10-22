import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  EnvKeyProvider,
  decryptField,
  encryptField,
  hmacLookup,
  sha256Hex,
} from "./crypto";

const key = new EnvKeyProvider(randomBytes(32).toString("base64"));
const otherKey = new EnvKeyProvider(randomBytes(32).toString("base64"));

describe("encryptField / decryptField", () => {
  it("round-trips a plaintext value", () => {
    const plaintext = "+254700000001";
    const encrypted = encryptField(plaintext, key);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptField(encrypted, key)).toBe(plaintext);
  });

  it("tags the ciphertext with the provider's current key id", () => {
    const encrypted = encryptField("value", key);
    const [keyId] = encrypted.split(".");
    expect(keyId).toBe(key.getCurrentKeyId());
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptField("same value", key);
    const b = encryptField("same value", key);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encryptField("sensitive", key);
    const [keyId, iv, tag, ciphertext] = encrypted.split(".");
    const tamperedByte = Buffer.from(ciphertext ?? "", "base64");
    tamperedByte[0] = (tamperedByte[0] ?? 0) ^ 0xff;
    const tampered = [keyId, iv, tag, tamperedByte.toString("base64")].join(
      ".",
    );
    expect(() => decryptField(tampered, key)).toThrow();
  });

  it("throws on tampered auth tag", () => {
    const encrypted = encryptField("sensitive", key);
    const [keyId, iv, tag, ciphertext] = encrypted.split(".");
    const tamperedTag = Buffer.from(tag ?? "", "base64");
    tamperedTag[0] = (tamperedTag[0] ?? 0) ^ 0xff;
    const tampered = [
      keyId,
      iv,
      tamperedTag.toString("base64"),
      ciphertext,
    ].join(".");
    expect(() => decryptField(tampered, key)).toThrow();
  });

  it("throws when decrypted with a provider that has no matching key id", () => {
    const encrypted = encryptField("sensitive", key);
    expect(() => decryptField(encrypted, otherKey)).toThrow();
  });

  it("throws on a malformed packed value", () => {
    expect(() => decryptField("not-a-valid-payload", key)).toThrow();
  });

  it("decrypts a legacy 3-segment value (no key id) using the provider's current key", () => {
    // Values written before key ids existed are plain iv.tag.ciphertext.
    const encrypted = encryptField("legacy value", key);
    const [, iv, tag, ciphertext] = encrypted.split(".");
    const legacyPacked = [iv, tag, ciphertext].join(".");
    expect(decryptField(legacyPacked, key)).toBe("legacy value");
  });

  it("key rotation: a provider with both the old and new key decrypts values written under either", () => {
    const oldKeyB64 = randomBytes(32).toString("base64");
    const newKeyB64 = randomBytes(32).toString("base64");

    const beforeRotation = new EnvKeyProvider({ "1": oldKeyB64 }, "1");
    const encryptedUnderOldKey = encryptField(
      "pre-rotation value",
      beforeRotation,
    );

    const afterRotation = new EnvKeyProvider(
      { "1": oldKeyB64, "2": newKeyB64 },
      "2",
    );
    const encryptedUnderNewKey = encryptField(
      "post-rotation value",
      afterRotation,
    );

    expect(encryptedUnderOldKey.split(".")[0]).toBe("1");
    expect(encryptedUnderNewKey.split(".")[0]).toBe("2");
    expect(decryptField(encryptedUnderOldKey, afterRotation)).toBe(
      "pre-rotation value",
    );
    expect(decryptField(encryptedUnderNewKey, afterRotation)).toBe(
      "post-rotation value",
    );
  });

  it("constructing a multi-key provider without currentKeyId throws", () => {
    expect(
      () => new EnvKeyProvider({ "1": randomBytes(32).toString("base64") }),
    ).toThrow();
  });

  it("constructing a multi-key provider with an unknown currentKeyId throws", () => {
    expect(
      () =>
        new EnvKeyProvider({ "1": randomBytes(32).toString("base64") }, "nope"),
    ).toThrow();
  });
});

describe("hmacLookup", () => {
  it("is deterministic for the same value and key", () => {
    expect(hmacLookup("+254700000001", key)).toBe(
      hmacLookup("+254700000001", key),
    );
  });

  it("differs for different values", () => {
    expect(hmacLookup("+254700000001", key)).not.toBe(
      hmacLookup("+254700000002", key),
    );
  });

  it("differs for different keys", () => {
    expect(hmacLookup("+254700000001", key)).not.toBe(
      hmacLookup("+254700000001", otherKey),
    );
  });
});

describe("sha256Hex", () => {
  it("never returns the plaintext input", () => {
    const token = randomBytes(32).toString("base64url");
    expect(sha256Hex(token)).not.toBe(token);
    expect(sha256Hex(token)).not.toContain(token);
  });

  it("is deterministic for the same value", () => {
    const token = randomBytes(32).toString("base64url");
    expect(sha256Hex(token)).toBe(sha256Hex(token));
  });

  it("differs for different values", () => {
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });

  it("produces a 64-character lowercase hex digest", () => {
    expect(sha256Hex("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
