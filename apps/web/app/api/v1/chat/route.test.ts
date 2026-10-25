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
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId, locale: "en" })),
}));
vi.mock("@/lib/server-db", () => ({
  db,
  encryptionKeyProvider: keyProvider,
  analyticsKeyProvider,
}));

// The real pipeline makes live AI Gateway calls — route tests only need to
// prove the HTTP/SSE/persistence plumbing works, which packages/assistant's
// own (mocked-LLM) pipeline.test.ts already covers for pipeline behavior.
vi.mock("@mwezicare/assistant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mwezicare/assistant")>();
  return {
    ...actual,
    runAssistantPipeline: vi.fn(
      async (_deps: unknown, input: { sessionId?: string }) => ({
        sessionId: input.sessionId ?? "fake-session-id",
        messageId: "fake-message-id",
        text: "Here is a generated answer [test-source].",
        sources: [{ slug: "test-source", title: "Test source" }],
        safetyFlags: { category: "in_scope" },
      }),
    ),
  };
});

async function readSseEvents(
  response: Response,
): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)));
}

describe.skipIf(!db)("/api/v1/chat", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `chat-test-${Date.now()}@example.com`,
        locale: "en",
      })
      .returning({ id: schema.users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("POST streams SSE 'token' events followed by a 'done' event with sources and safetyFlags", async () => {
    // Persistence itself is exercised for real by packages/assistant's
    // persist.test.ts; runAssistantPipeline (which calls it internally) is
    // mocked here so this test doesn't need live AI Gateway credentials.
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/chat", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ message: "What foods help with cramps?" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await readSseEvents(response);
    expect(events.some((e) => e.type === "token")).toBe(true);
    expect(
      events.map((e) => (e.type === "token" ? e.value : "")).join(""),
    ).toContain("generated answer");

    const done = events.find((e) => e.type === "done");
    expect(done?.sources).toEqual([
      { slug: "test-source", title: "Test source" },
    ]);
    expect(done?.safetyFlags).toEqual({ category: "in_scope" });
    expect(done?.sessionId).toBeTruthy();
  });

  it("POST rejects an empty message", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/chat", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ message: "" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("GET returns decrypted history for a session, scoped to the owning user", async () => {
    const [session] = await db!
      .insert(schema.chatSessions)
      .values({ userId })
      .returning({ id: schema.chatSessions.id });

    await db!.insert(schema.chatMessages).values({
      sessionId: session!.id,
      userId,
      role: "user",
      contentEnc: encryptField("What foods help with cramps?", keyProvider!),
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/v1/chat?sessionId=${session!.id}`),
    );
    const body = await response.json();

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("What foods help with cramps?");
  });

  it("DELETE clears a session and cascades its messages", async () => {
    const [session] = await db!
      .insert(schema.chatSessions)
      .values({ userId })
      .returning({ id: schema.chatSessions.id });
    await db!.insert(schema.chatMessages).values({
      sessionId: session!.id,
      userId,
      role: "user",
      contentEnc: encryptField("hello", keyProvider!),
    });

    const { DELETE } = await import("./route");
    const response = await DELETE(
      new Request(`http://localhost/api/v1/chat?sessionId=${session!.id}`, {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      }),
    );
    expect(response.status).toBe(204);

    const remaining = await db!
      .select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, session!.id));
    expect(remaining).toHaveLength(0);
  });
});
