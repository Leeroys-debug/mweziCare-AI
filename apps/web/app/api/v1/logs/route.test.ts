import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, withUser, type Database } from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

let userId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", async () => {
  const { EnvKeyProvider } = await import("@mwezicare/db");
  return {
    db,
    encryptionKeyProvider: new EnvKeyProvider(
      Buffer.alloc(32, 7).toString("base64"),
    ),
  };
});

describe.skipIf(!db)("GET /api/v1/logs", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        phoneNumber: `logs-range-test-${Date.now()}`,
        email: `logs-range-test-${Date.now()}@phone.mwezicare.invalid`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    await withUser(db!, userId, (tx) =>
      tx.insert(schema.symptomLogs).values([
        { userId, logDate: "2026-04-01", painScore: 2, clientId: "r1" },
        { userId, logDate: "2026-04-15", painScore: 5, clientId: "r2" },
        { userId, logDate: "2026-05-01", painScore: 1, clientId: "r3" }, // outside range
      ]),
    );
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("returns only logs within the requested date range", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/logs?from=2026-04-01&to=2026-04-30"),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.logs).toHaveLength(2);
    expect(body.logs.map((l: { logDate: string }) => l.logDate)).toEqual([
      "2026-04-01",
      "2026-04-15",
    ]);
  });

  it("rejects a missing or malformed date range", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/v1/logs?from=04-01-2026&to=2026-04-30"),
    );
    expect(response.status).toBe(400);
  });
});
