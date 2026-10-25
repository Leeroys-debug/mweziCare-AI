import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createDb,
  EnvKeyProvider,
  schema,
  sha256Hex,
  withUser,
  type Database,
} from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId, locale: "en" })),
}));
vi.mock("@/lib/server-db", () => ({ db, analyticsKeyProvider }));

async function grantSharingConsent() {
  await db!
    .insert(schema.consents)
    .values({ userId, purpose: "sharing", version: 1, grantedAt: new Date() });
}

describe.skipIf(!db)("POST /api/v1/summaries", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        email: `summary-test-${Date.now()}@example.com`,
        locale: "en",
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    await db!
      .insert(schema.profiles)
      .values({ userId, ageBand: "21-24", county: "Kiambu" });

    await withUser(db!, userId, (tx) =>
      tx.insert(schema.symptomLogs).values([
        {
          userId,
          logDate: "2026-01-01",
          periodDay: true,
          painScore: 5,
          clientId: "s1",
        },
        {
          userId,
          logDate: "2026-01-29",
          periodDay: true,
          painScore: 6,
          clientId: "s2",
        },
      ]),
    );
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("rejects creation when sharing consent hasn't been granted", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/summaries", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ range: "3_cycles" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("creates a summary + PDF + share link once sharing consent is granted, and never stores the token in plaintext", async () => {
    await grantSharingConsent();

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/summaries", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ range: "3_cycles", displayLabel: "A.N." }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(20);
    expect(body.summary.id).toBeTruthy();

    const [row] = await db!
      .select()
      .from(schema.summaries)
      .where(eq(schema.summaries.id, body.summary.id));
    expect(row?.shareTokenHash).toBe(sha256Hex(body.token));
    expect(row?.shareTokenHash).not.toBe(body.token);
    expect(row?.pdfKey).toMatch(/^summaries\/.+\.pdf$/);
  });

  it("rejects a custom range missing from/to", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/summaries", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ range: "custom" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
