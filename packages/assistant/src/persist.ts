import { and, eq, sql } from "drizzle-orm";
import {
  encryptField,
  schema,
  withUser,
  type Database,
  type KeyProvider,
} from "@mwezicare/db";

export type ChatRole = "user" | "assistant";

export interface PersistMessageInput {
  db: Database;
  userId: string;
  sessionId?: string;
  role: ChatRole;
  /** Plaintext — encrypted before it ever reaches the database (CLAUDE.md). */
  content: string;
  keyProvider: KeyProvider;
  safetyFlags?: Record<string, unknown>;
  sources?: string[];
}

export interface PersistMessageResult {
  sessionId: string;
  messageId: string;
}

/**
 * Creates (or reuses, if owned by this user) a chat session and appends one
 * encrypted message to it, in a single RLS-scoped transaction (withUser —
 * packages/db/src/client.ts). No name/phone/location/user-id is ever part
 * of `content` — callers pass only the raw message/response text.
 */
export async function persistMessage(
  input: PersistMessageInput,
): Promise<PersistMessageResult> {
  return withUser(input.db, input.userId, async (tx) => {
    let sessionId = input.sessionId;

    if (sessionId) {
      const [existing] = await tx
        .select({ id: schema.chatSessions.id })
        .from(schema.chatSessions)
        .where(
          and(
            eq(schema.chatSessions.id, sessionId),
            eq(schema.chatSessions.userId, input.userId),
          ),
        );
      if (!existing) sessionId = undefined;
    }

    if (!sessionId) {
      const [created] = await tx
        .insert(schema.chatSessions)
        .values({ userId: input.userId })
        .returning({ id: schema.chatSessions.id });
      sessionId = created!.id;
    }

    const [message] = await tx
      .insert(schema.chatMessages)
      .values({
        sessionId,
        userId: input.userId,
        role: input.role,
        contentEnc: encryptField(input.content, input.keyProvider),
        safetyFlags: input.safetyFlags ?? null,
        sources: input.sources ?? null,
      })
      .returning({ id: schema.chatMessages.id });

    return { sessionId, messageId: message!.id };
  });
}

/** Deletes a session and (cascade) its messages — the chat UI's "clear history". */
export async function clearSession(
  db: Database,
  userId: string,
  sessionId: string,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    await tx
      .delete(schema.chatSessions)
      .where(
        and(
          eq(schema.chatSessions.id, sessionId),
          eq(schema.chatSessions.userId, userId),
        ),
      );
  });
}

export type MessageFeedback = "up" | "down";

/** Merged into the message's safetyFlags jsonb rather than a dedicated column. */
export async function setMessageFeedback(
  db: Database,
  userId: string,
  messageId: string,
  feedback: MessageFeedback,
): Promise<void> {
  await withUser(db, userId, async (tx) => {
    await tx
      .update(schema.chatMessages)
      .set({
        safetyFlags: sql`coalesce(${schema.chatMessages.safetyFlags}, '{}'::jsonb) || ${JSON.stringify({ feedback })}::jsonb`,
      })
      .where(
        and(
          eq(schema.chatMessages.id, messageId),
          eq(schema.chatMessages.userId, userId),
        ),
      );
  });
}
