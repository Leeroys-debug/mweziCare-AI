import { sql } from "drizzle-orm";
import { schema, type Database } from "@mwezicare/db";
import type { RawFacilityRecord } from "./types";

export interface ImportResult {
  facilitiesUpserted: number;
  servicesUpserted: number;
}

/**
 * Upserts facilities by kmhfl_code and their services by
 * (facility_id, service_code). A human-set 'verified' status is never
 * overwritten by an import — enforced in the upsert's own CASE WHEN, not by
 * reading first, so a concurrent verification can't race a running import.
 */
export async function importFacilities(
  db: Database,
  records: RawFacilityRecord[],
): Promise<ImportResult> {
  let facilitiesUpserted = 0;
  let servicesUpserted = 0;

  for (const record of records) {
    const [facility] = await db
      .insert(schema.facilities)
      .values({
        kmhflCode: record.kmhflCode,
        name: record.name,
        county: record.county,
        subCounty: record.subCounty ?? null,
        geom: { lat: record.lat, lng: record.lng },
        phone: record.phone ?? null,
        kephLevel: record.kephLevel ?? null,
        ownership: record.ownership ?? null,
      })
      .onConflictDoUpdate({
        target: schema.facilities.kmhflCode,
        set: {
          name: record.name,
          county: record.county,
          subCounty: record.subCounty ?? null,
          geom: { lat: record.lat, lng: record.lng },
          phone: record.phone ?? null,
          kephLevel: record.kephLevel ?? null,
          ownership: record.ownership ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.facilities.id });
    facilitiesUpserted++;

    for (const service of record.services) {
      await db
        .insert(schema.facilityServices)
        .values({
          facilityId: facility!.id,
          serviceCode: service.serviceCode,
          status: "listed",
          source: "kmhfl",
        })
        .onConflictDoUpdate({
          target: [
            schema.facilityServices.facilityId,
            schema.facilityServices.serviceCode,
          ],
          set: {
            status: sql`CASE WHEN ${schema.facilityServices.status} = 'verified' THEN ${schema.facilityServices.status} ELSE excluded.status END`,
            source: sql`CASE WHEN ${schema.facilityServices.status} = 'verified' THEN ${schema.facilityServices.source} ELSE excluded.source END`,
            lastVerifiedAt: sql`CASE WHEN ${schema.facilityServices.status} = 'verified' THEN ${schema.facilityServices.lastVerifiedAt} ELSE excluded.last_verified_at END`,
          },
        });
      servicesUpserted++;
    }
  }

  return { facilitiesUpserted, servicesUpserted };
}
