import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, withUser, type Database } from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

let userId: string;
let otherUserId: string;
let summaryId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", () => ({ db }));

describe.skipIf(!db)("POST /api/v1/summaries/:id/revoke", () => {
  beforeAll(async () => {
    const users = await db!
      .insert(schema.users)
      .values([
        {
          email: `revoke-test-a-${Date.now()}@example.com`,
        },
        {
          email: `revoke-test-b-${Date.now()}@example.com`,
        },
      ])
      .returning({ id: schema.users.id });
    userId = users[0]!.id;
    otherUserId = users[1]!.id;

    const [summary] = await withUser(db!, userId, (tx) =>
      tx
        .insert(schema.summaries)
        .values({
          userId,
          period: "3_cycles",
          pdfKey: "summaries/revoke-test.pdf",
          shareTokenHash: "a".repeat(64),
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        })
        .returning({ id: schema.summaries.id }),
    );
    summaryId = summary!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
    await db!.delete(schema.users).where(eq(schema.users.id, otherUserId));
  });

  it("404s when another user tries to revoke it", async () => {
    userId = otherUserId; // getCurrentUser mock reads this
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      {
        params: Promise.resolve({ id: summaryId }),
      },
    );
    expect(response.status).toBe(404);
  });

  it("revokes the owner's own summary", async () => {
    const [summary] = await db!
      .select()
      .from(schema.summaries)
      .where(eq(schema.summaries.id, summaryId));
    userId = summary!.userId; // restore owner for the mock
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      }),
      {
        params: Promise.resolve({ id: summaryId }),
      },
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.summary.revokedAt).toBeTruthy();
  });
});
