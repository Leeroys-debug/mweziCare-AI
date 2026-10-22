import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createDb, EnvKeyProvider, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

let userId: string;
let facilityId: string;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: userId })),
}));
vi.mock("@/lib/server-db", () => ({ db, analyticsKeyProvider }));

describe.skipIf(!db)("POST /api/v1/referrals", () => {
  beforeAll(async () => {
    const [user] = await db!
      .insert(schema.users)
      .values({
        phoneNumber: `referral-test-${Date.now()}`,
        email: `referral-test-${Date.now()}@phone.mwezicare.invalid`,
      })
      .returning({ id: schema.users.id });
    userId = user!.id;

    const [facility] = await db!
      .insert(schema.facilities)
      .values({
        kmhflCode: `REFERRAL-TEST-${Date.now()}`,
        name: "Referral Test Facility",
        county: "Kiambu",
      })
      .returning({ id: schema.facilities.id });
    facilityId = facility!.id;
  });

  afterAll(async () => {
    await db!.delete(schema.users).where(eq(schema.users.id, userId));
    await db!
      .delete(schema.facilities)
      .where(eq(schema.facilities.id, facilityId));
  });

  it("records a referral for the signed-in user", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/referrals", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ facilityId, followUpConsent: true }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.referral.userId).toBe(userId);
    expect(body.referral.facilityId).toBe(facilityId);
    expect(body.referral.followUpConsent).toBe(true);
  });

  it("rejects a malformed payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/v1/referrals", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: JSON.stringify({ facilityId: "not-a-uuid" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
