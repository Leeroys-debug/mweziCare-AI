import { config } from "dotenv";
import { like } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createDb, EnvKeyProvider, schema, type Database } from "@mwezicare/db";

config({ path: "../../.env" }); // dotenv resolves relative to process.cwd(), i.e. apps/web

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

vi.mock("@/lib/rbac", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "5f1c5e3a-0000-4000-8000-000000000099",
  })),
}));
vi.mock("@/lib/server-db", () => ({ db, analyticsKeyProvider }));

describe.skipIf(!db)("GET /api/v1/facilities/search", () => {
  afterAll(async () => {
    await db!
      .delete(schema.facilities)
      .where(like(schema.facilities.kmhflCode, "SEARCH-TEST-%"));
  });

  it("geo mode returns facilities ordered by distance", async () => {
    await db!.insert(schema.facilities).values([
      {
        kmhflCode: "SEARCH-TEST-1",
        name: "Near",
        county: "Kiambu",
        geom: { lat: -1.1715, lng: 36.8356 },
      },
      {
        kmhflCode: "SEARCH-TEST-2",
        name: "Far",
        county: "Kiambu",
        geom: { lat: -1.3, lng: 36.9 },
      },
    ]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/v1/facilities/search?lat=-1.1714&lng=36.8356&radiusKm=50",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("geo");
    const codes = body.results
      .map((r: { kmhflCode: string }) => r.kmhflCode)
      .filter((c: string) => c.startsWith("SEARCH-TEST-"));
    expect(codes).toEqual(["SEARCH-TEST-1", "SEARCH-TEST-2"]);
  });

  it("area mode searches by county/name when lat/lng are absent", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/v1/facilities/search?county=Kiambu&q=Near",
      ),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("area");
  });

  it("rejects an out-of-range latitude", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/v1/facilities/search?lat=999&lng=36.8&radiusKm=10",
      ),
    );
    expect(response.status).toBe(400);
  });
});
