import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createDb,
  EnvKeyProvider,
  encryptField,
  schema,
  type Database,
} from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

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

let userId: string;
let messageId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId, locale: "en" })),
}));
vi.mock("@/lib/server-db", () => ({ db }));

describe.skipIf(!db)("POST /api/v1/chat/feedback", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `chat-feedback-test-${Date.now()}@example.com`,
        locale: "en",
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    const [session] = await db!
      .insert(schema.chatSessions)
      .values({ userId })
      .returning({ id: schema.chatSessions.id });
    const [message] = await db!
      .insert(schema.chatMessages)
      .values({
        sessionId: session!.id,
        userId,
        role: "assistant",
        contentEnc: encryptField("A generated answer.", keyProvider!),
      })
      .returning({ id: schema.chatMessages.id });
    messageId = message!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("merges feedback into the message's safetyFlags", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/chat/feedback", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ messageId, feedback: "up" }),
      }),
    );
    expect(response.status).toBe(200);

    const [row] = await db!
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, messageId));
    expect(row?.safetyFlags).toEqual({ feedback: "up" });
  });

  it("rejects an invalid feedback value", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/chat/feedback", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ messageId, feedback: "sideways" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
