import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema, type Database } from "@mwezicare/db";
import {
  startTestDatabase,
  type TestDatabase,
} from "@mwezicare/db/testcontainers-setup";
import { areaSearch, geoSearch } from "./geo-search";

// A cold build of infra/postgres/Dockerfile pulls the full PostGIS/GDAL
// dependency chain (dozens of packages) over apt — comfortably over 3
// minutes on a slower network/mirror, well past vitest's hook default
// (measured ~16 min cold on a fresh Docker Desktop install with no prior
// image/layer cache at all).
// Only the first run per machine pays this.
const CONTAINER_TIMEOUT_MS = 1_200_000;

/**
 * Real-Postgres (PostGIS) integration test for geoSearch, against a
 * database this test builds and migrates itself
 * (packages/db/src/testcontainers-setup.ts — the same custom image
 * docker-compose.yml's `postgres` service builds, full migration set), not
 * the dev docker-compose stack or a hand-rolled minimal schema.
 */
describe("geoSearch (testcontainers)", () => {
  let testDb: TestDatabase;
  let db: Database;

  const nairobiCbd = { lat: -1.2921, lng: 36.8219 };
  // Offsets along latitude only, so straight-line distance ~= |offsetKm|.
  const kmToDegrees = (km: number) => km / 111;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;

    async function seed(code: string, name: string, offsetKm: number) {
      const [facility] = await db
        .insert(schema.facilities)
        .values({
          kmhflCode: code,
          name,
          county: "Nairobi",
          geom: {
            lat: nairobiCbd.lat - kmToDegrees(offsetKm),
            lng: nairobiCbd.lng,
          },
        })
        .returning({ id: schema.facilities.id });
      return facility!.id;
    }

    const nearId = await seed("TC-GEO-NEAR", "Near Facility (~0.5km)", 0.5);
    const midId = await seed("TC-GEO-MID", "Mid Facility (~5km)", 5);
    await seed("TC-GEO-FAR", "Far-but-in-range Facility (~20km)", 20);
    await seed("TC-GEO-OUT-OF-RANGE", "Out of range Facility (~50km)", 50);

    await db.insert(schema.facilityServices).values([
      { facilityId: nearId, serviceCode: "GYN", status: "verified" },
      { facilityId: midId, serviceCode: "GYN", status: "listed" },
    ]);

    // Mixed-case county/name on purpose — areaSearch must match these
    // regardless of how the caller capitalises their query.
    await db.insert(schema.facilities).values({
      kmhflCode: "TC-AREA-KIAMBU",
      name: "Thika Road Test Clinic",
      county: "Kiambu",
      geom: nairobiCbd,
    });
  }, CONTAINER_TIMEOUT_MS);

  afterAll(async () => {
    if (db)
      await db
        .delete(schema.facilities)
        .where(like(schema.facilities.kmhflCode, "TC-%"));
    await testDb?.stop();
  }, CONTAINER_TIMEOUT_MS);

  it("returns facilities within the radius, ordered nearest-first", async () => {
    const results = await geoSearch(db, {
      lat: nairobiCbd.lat,
      lng: nairobiCbd.lng,
      radiusKm: 25,
    });
    const inRange = results.filter((r) => r.kmhflCode.startsWith("TC-GEO-"));

    expect(inRange.map((r) => r.kmhflCode)).toEqual([
      "TC-GEO-NEAR",
      "TC-GEO-MID",
      "TC-GEO-FAR",
    ]);
    expect(inRange.map((r) => r.distanceMeters)).toEqual(
      [...inRange.map((r) => r.distanceMeters)].sort(
        (a, b) => (a ?? 0) - (b ?? 0),
      ),
    );
  });

  it("excludes facilities outside the radius", async () => {
    const results = await geoSearch(db, {
      lat: nairobiCbd.lat,
      lng: nairobiCbd.lng,
      radiusKm: 25,
    });
    expect(
      results.find((r) => r.kmhflCode === "TC-GEO-OUT-OF-RANGE"),
    ).toBeUndefined();
  });

  it("filters to a verified service when verifiedOnly is set", async () => {
    const results = await geoSearch(db, {
      lat: nairobiCbd.lat,
      lng: nairobiCbd.lng,
      radiusKm: 25,
      service: "GYN",
      verifiedOnly: true,
    });

    const codes = results
      .map((r) => r.kmhflCode)
      .filter((c) => c.startsWith("TC-GEO-"));
    expect(codes).toEqual(["TC-GEO-NEAR"]);
  });

  it("areaSearch matches a county regardless of casing or surrounding whitespace", async () => {
    for (const county of ["Kiambu", "kiambu", "KIAMBU", " Kiambu  "]) {
      const results = await areaSearch(db, { county });
      expect(
        results.map((r) => r.kmhflCode),
        `county=${JSON.stringify(county)}`,
      ).toContain("TC-AREA-KIAMBU");
    }
  });

  it("areaSearch returns nothing for a county with no facilities", async () => {
    const results = await areaSearch(db, { county: "Nowhereshire" });
    expect(results).toHaveLength(0);
  });

  it("areaSearch's free-text name query is case-insensitive", async () => {
    const results = await areaSearch(db, { q: "thika road" });
    expect(results.map((r) => r.kmhflCode)).toContain("TC-AREA-KIAMBU");
  });
});
