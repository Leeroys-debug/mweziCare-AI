import path from "node:path";
import { config } from "dotenv";
import { and, eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";
import { FileAdapter } from "./adapters/file-adapter";
import { importFacilities } from "./import";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

const fixturesDir = path.join(import.meta.dirname, "fixtures");

async function cleanup(database: Database) {
  await database
    .delete(schema.facilities)
    .where(like(schema.facilities.kmhflCode, "TEST-%"));
}

describe.skipIf(!db)("importFacilities", () => {
  afterAll(async () => {
    await cleanup(db!);
  });

  it("is idempotent — importing the same extract twice doesn't duplicate rows", async () => {
    const database = db!;
    await cleanup(database);
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.csv"),
    );
    const records = await adapter.fetchFacilities();

    await importFacilities(database, records);
    await importFacilities(database, records);

    const rows = await database
      .select()
      .from(schema.facilities)
      .where(like(schema.facilities.kmhflCode, "TEST-%"));
    expect(rows).toHaveLength(2);

    const [facility] = rows.filter((r) => r.kmhflCode === "TEST-001");
    const services = await database
      .select()
      .from(schema.facilityServices)
      .where(eq(schema.facilityServices.facilityId, facility!.id));
    expect(services).toHaveLength(2); // GYN, OPD — not duplicated
  });

  it("never overwrites a human-verified service status on re-import", async () => {
    const database = db!;
    await cleanup(database);
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.csv"),
    );
    const records = await adapter.fetchFacilities();

    await importFacilities(database, records);

    const [facility] = await database
      .select()
      .from(schema.facilities)
      .where(eq(schema.facilities.kmhflCode, "TEST-001"));

    // A human verifier marks GYN (only) verified.
    await database
      .update(schema.facilityServices)
      .set({
        status: "verified",
        source: "manual verification call",
        lastVerifiedAt: new Date("2026-01-01"),
      })
      .where(
        and(
          eq(schema.facilityServices.facilityId, facility!.id),
          eq(schema.facilityServices.serviceCode, "GYN"),
        ),
      );

    // Re-running the import must not clobber that.
    await importFacilities(database, records);

    const [gyn] = await database
      .select()
      .from(schema.facilityServices)
      .where(eq(schema.facilityServices.facilityId, facility!.id))
      .orderBy(schema.facilityServices.serviceCode);

    expect(gyn?.status).toBe("verified");
    expect(gyn?.source).toBe("manual verification call");
    expect(gyn?.lastVerifiedAt?.toISOString().slice(0, 10)).toBe("2026-01-01");
  });

  it("updates mutable facility fields (e.g. phone) on re-import", async () => {
    const database = db!;
    await cleanup(database);
    const adapter = new FileAdapter(
      path.join(fixturesDir, "sample-extract.csv"),
    );
    const records = await adapter.fetchFacilities();
    await importFacilities(database, records);

    const updated = records.map((r) =>
      r.kmhflCode === "TEST-001" ? { ...r, phone: "+254700099999" } : r,
    );
    await importFacilities(database, updated);

    const [facility] = await database
      .select()
      .from(schema.facilities)
      .where(eq(schema.facilities.kmhflCode, "TEST-001"));
    expect(facility?.phone).toBe("+254700099999");
  });
});
