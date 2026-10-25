import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  createDb,
  decryptField,
  EnvKeyProvider,
  schema,
  type Database,
} from "@mwezicare/db";
import { clearSession, persistMessage, setMessageFeedback } from "./persist";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. packages/assistant

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const keyProvider =
  process.env.ENCRYPTION_KEYS && process.env.ENCRYPTION_KEY_ID
    ? new EnvKeyProvider(
        JSON.parse(process.env.ENCRYPTION_KEYS) as Record<string, string>,
        process.env.ENCRYPTION_KEY_ID,
      )
    : undefined;

describe.skipIf(!db)(
  "persistMessage / clearSession / setMessageFeedback",
  () => {
    let userId: string;

    afterAll(async () => {
      if (userId)
        await db!.delete(schema.users).where(eq(schema.users.id, userId));
    });

    it("encrypts message content and round-trips through decryptField", async () => {
      const [user] = await db!
        .insert(schema.users)
        .values({
          email: `assistant-persist-test-${Date.now()}@example.com`,
          locale: "en",
        })
        .returning({ id: schema.users.id });
      userId = user!.id;

      const { sessionId, messageId } = await persistMessage({
        db: db!,
        userId,
        role: "user",
        content: "What foods help with cramps?",
        keyProvider: keyProvider!,
      });
      expect(sessionId).toBeTruthy();

      const [row] = await db!
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId));
      expect(row!.contentEnc).not.toContain("cramps"); // stored ciphertext, never plaintext
      expect(decryptField(row!.contentEnc, keyProvider!)).toBe(
        "What foods help with cramps?",
      );

      // A second message with the same sessionId reuses the session.
      const second = await persistMessage({
        db: db!,
        userId,
        sessionId,
        role: "assistant",
        content: "Here is an answer.",
        keyProvider: keyProvider!,
        sources: ["test-source"],
      });
      expect(second.sessionId).toBe(sessionId);

      await setMessageFeedback(db!, userId, messageId, "up");
      const [afterFeedback] = await db!
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, messageId));
      expect(afterFeedback!.safetyFlags).toEqual({ feedback: "up" });

      await clearSession(db!, userId, sessionId);
      const remaining = await db!
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.sessionId, sessionId));
      expect(remaining).toHaveLength(0);
    });

    it("does not reuse a session owned by a different user", async () => {
      const [userA] = await db!
        .insert(schema.users)
        .values({
          email: `assistant-persist-a-${Date.now()}@example.com`,
          locale: "en",
        })
        .returning({ id: schema.users.id });
      const [userB] = await db!
        .insert(schema.users)
        .values({
          email: `assistant-persist-b-${Date.now()}@example.com`,
          locale: "en",
        })
        .returning({ id: schema.users.id });

      const first = await persistMessage({
        db: db!,
        userId: userA!.id,
        role: "user",
        content: "hello",
        keyProvider: keyProvider!,
      });

      const second = await persistMessage({
        db: db!,
        userId: userB!.id,
        sessionId: first.sessionId,
        role: "user",
        content: "hello from a different user",
        keyProvider: keyProvider!,
      });
      expect(second.sessionId).not.toBe(first.sessionId);

      await db!.delete(schema.users).where(eq(schema.users.id, userA!.id));
      await db!.delete(schema.users).where(eq(schema.users.id, userB!.id));
    });
  },
);
