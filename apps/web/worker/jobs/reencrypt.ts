import { eq, isNotNull } from "drizzle-orm";
import {
  createDb,
  decryptField,
  encryptField,
  EnvKeyProvider,
  schema,
  type Database,
  type KeyProvider,
} from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { logger } from "@/lib/logger";

/**
 * True once a packed ciphertext is already tagged with the provider's
 * current key — re-encrypting it again would be a no-op write.
 */
function isAlreadyCurrent(packed: string, provider: KeyProvider): boolean {
  const [keyId] = packed.split(".");
  return keyId === provider.getCurrentKeyId() && packed.split(".").length === 4;
}

async function reencryptUsersPhone(
  db: Database,
  provider: KeyProvider,
): Promise<number> {
  const rows = await db
    .select({ id: schema.users.id, phoneEnc: schema.users.phoneEnc })
    .from(schema.users)
    .where(isNotNull(schema.users.phoneEnc));

  let rewritten = 0;
  for (const row of rows) {
    if (!row.phoneEnc || isAlreadyCurrent(row.phoneEnc, provider)) continue;
    const plaintext = decryptField(row.phoneEnc, provider);
    await db
      .update(schema.users)
      .set({ phoneEnc: encryptField(plaintext, provider) })
      .where(eq(schema.users.id, row.id));
    rewritten++;
  }
  return rewritten;
}

async function reencryptSymptomLogNotes(
  db: Database,
  provider: KeyProvider,
): Promise<number> {
  const rows = await db
    .select({
      id: schema.symptomLogs.id,
      notesEnc: schema.symptomLogs.notesEnc,
    })
    .from(schema.symptomLogs)
    .where(isNotNull(schema.symptomLogs.notesEnc));

  let rewritten = 0;
  for (const row of rows) {
    if (!row.notesEnc || isAlreadyCurrent(row.notesEnc, provider)) continue;
    const plaintext = decryptField(row.notesEnc, provider);
    await db
      .update(schema.symptomLogs)
      .set({ notesEnc: encryptField(plaintext, provider) })
      .where(eq(schema.symptomLogs.id, row.id));
    rewritten++;
  }
  return rewritten;
}

async function reencryptChatMessages(
  db: Database,
  provider: KeyProvider,
): Promise<number> {
  const rows = await db
    .select({
      id: schema.chatMessages.id,
      contentEnc: schema.chatMessages.contentEnc,
    })
    .from(schema.chatMessages);

  let rewritten = 0;
  for (const row of rows) {
    if (isAlreadyCurrent(row.contentEnc, provider)) continue;
    const plaintext = decryptField(row.contentEnc, provider);
    await db
      .update(schema.chatMessages)
      .set({ contentEnc: encryptField(plaintext, provider) })
      .where(eq(schema.chatMessages.id, row.id));
    rewritten++;
  }
  return rewritten;
}

/**
 * One-off re-encryption job (F1 spec) — run manually once after rotating
 * ENCRYPTION_KEY_ID (`pnpm --filter @mwezicare/web run reencrypt`), to
 * re-write every encrypted field under the new current key so the retired
 * key id can eventually be dropped from ENCRYPTION_KEYS. Idempotent and
 * safe to re-run: `isAlreadyCurrent` skips any row already tagged with the
 * current key, so an interrupted run just picks up where it left off.
 */
export interface ReencryptCounts {
  usersRewritten: number;
  symptomLogsRewritten: number;
  chatMessagesRewritten: number;
}

export async function runReencrypt(
  db?: Database,
  provider?: KeyProvider,
): Promise<ReencryptCounts> {
  const env = loadServerEnv();
  const database = db ?? createDb(env.DATABASE_URL);
  const keyProvider =
    provider ?? new EnvKeyProvider(env.ENCRYPTION_KEYS, env.ENCRYPTION_KEY_ID);

  const counts: ReencryptCounts = {
    usersRewritten: await reencryptUsersPhone(database, keyProvider),
    symptomLogsRewritten: await reencryptSymptomLogNotes(database, keyProvider),
    chatMessagesRewritten: await reencryptChatMessages(database, keyProvider),
  };

  logger.info(
    { ...counts, currentKeyId: keyProvider.getCurrentKeyId() },
    "reencrypt: complete",
  );
  return counts;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runReencrypt()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
