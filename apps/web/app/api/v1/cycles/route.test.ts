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
vi.mock("@/lib/server-db", () => ({ db }));

describe.skipIf(!db)("GET /api/v1/cycles", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        phoneNumber: `cycles-test-${Date.now()}`,
        email: `cycles-test-${Date.now()}@phone.mwezicare.invalid`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    await withUser(db!, userId, (tx) =>
      tx.insert(schema.symptomLogs).values([
        {
          userId,
          logDate: "2026-01-01",
          periodDay: true,
          painScore: 4,
          clientId: "c1",
        },
        {
          userId,
          logDate: "2026-01-02",
          periodDay: true,
          painScore: 3,
          clientId: "c2",
        },
        {
          userId,
          logDate: "2026-01-29",
          periodDay: true,
          painScore: 5,
          clientId: "c3",
        },
      ]),
    );
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
  });

  it("derives cycles, a next-period estimate, and per-cycle chart data from the user's own logs", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cycles).toHaveLength(2);
    expect(body.cycles[0]).toMatchObject({
      startDate: "2026-01-01",
      cycleLengthDays: 28,
    });
    expect(body.nextPeriodEstimate).toEqual({
      date: "2026-02-26",
      isEstimate: true,
    });
    expect(body.chartData.length).toBeGreaterThan(0);
  });
});
