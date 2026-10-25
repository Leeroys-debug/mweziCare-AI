import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createDb,
  encryptField,
  EnvKeyProvider,
  schema,
  type Database,
} from "@mwezicare/db";
import { runReencrypt } from "./reencrypt";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

const oldKeyB64 = randomBytes(32).toString("base64");
const newKeyB64 = randomBytes(32).toString("base64");
const oldProvider = new EnvKeyProvider({ "1": oldKeyB64 }, "1");
const rotatedProvider = new EnvKeyProvider(
  { "1": oldKeyB64, "2": newKeyB64 },
  "2",
);

let userId: string;

describe.skipIf(!db)("runReencrypt", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `reencrypt-test-${Date.now()}@example.com`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    await db!.insert(schema.symptomLogs).values({
      userId,
      logDate: "2026-04-01",
      clientId: "reencrypt-test-log",
      notesEnc: encryptField("private note", oldProvider),
    });

    const [session] = await db!
      .insert(schema.chatSessions)
      .values({ userId })
      .returning({ id: schema.chatSessions.id });
    await db!.insert(schema.chatMessages).values({
      sessionId: session!.id,
      userId,
      role: "user",
      contentEnc: encryptField("a chat message", oldProvider),
    });
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("re-writes notes/chat ciphertext under the new current key, preserving plaintext", async () => {
    const counts = await runReencrypt(db!, rotatedProvider);
    expect(counts).toEqual({
      symptomLogsRewritten: 1,
      chatMessagesRewritten: 1,
    });

    const [log] = await db!
      .select()
      .from(schema.symptomLogs)
      .where(eq(schema.symptomLogs.userId, userId));
    expect(log?.notesEnc?.split(".")[0]).toBe("2");

    const [message] = await db!
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.userId, userId));
    expect(message?.contentEnc.split(".")[0]).toBe("2");
  });

  it("is idempotent — a second run rewrites nothing", async () => {
    const counts = await runReencrypt(db!, rotatedProvider);
    expect(counts).toEqual({
      symptomLogsRewritten: 0,
      chatMessagesRewritten: 0,
    });
  });
});
