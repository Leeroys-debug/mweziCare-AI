import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({ id: "route-test-user" })),
}));
vi.mock("@/lib/server-db", () => ({ db }));

describe.skipIf(!db)("GET /api/v1/facilities/:id", () => {
  afterAll(async () => {
    await db!
      .delete(schema.facilities)
      .where(eq(schema.facilities.kmhflCode, "DETAIL-TEST-1"));
  });

  it("returns the facility with its services", async () => {
    const [facility] = await db!
      .insert(schema.facilities)
      .values({
        kmhflCode: "DETAIL-TEST-1",
        name: "Detail Test Facility",
        county: "Kiambu",
        geom: { lat: -1.17, lng: 36.83 },
      })
      .returning({ id: schema.facilities.id });
    await db!.insert(schema.facilityServices).values({
      facilityId: facility!.id,
      serviceCode: "GYN",
      status: "verified",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(`http://localhost/api/v1/facilities/${facility!.id}`),
      {
        params: Promise.resolve({ id: facility!.id }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.facility.kmhflCode).toBe("DETAIL-TEST-1");
    expect(body.facility.services).toEqual([
      { serviceCode: "GYN", status: "verified", lastVerifiedAt: null },
    ]);
  });

  it("404s for an unknown id", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/v1/facilities/00000000-0000-4000-8000-000000000000",
      ),
      {
        params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }),
      },
    );
    expect(response.status).toBe(404);
  });
});
