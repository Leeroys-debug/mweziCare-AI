import { z } from "zod";
import type { FacilitySourceAdapter, RawFacilityRecord } from "../types";

/**
 * [CLINICAL REVIEW REQUIRED] — not against clinical content, but against the
 * real KMHFL API: this field mapping is a best-effort guess at a typical
 * paginated-REST facility-registry shape (see
 * https://mfl-api-docs.readthedocs.io/), not verified against real
 * responses or credentials. Confirm field names, pagination shape and auth
 * scheme against the live API before this adapter is used for a real
 * import — the FileAdapter (CSV/GeoJSON) is the adapter that's actually
 * exercised by tests and the pilot-county import.
 */
const kmhflPageSchema = z.object({
  results: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      county: z.string(),
      sub_county: z.string().nullish(),
      latitude: z.number(),
      longitude: z.number(),
      phone_number: z.string().nullish(),
      keph_level: z.string().nullish(),
      owner: z.string().nullish(),
      services: z.array(z.object({ code: z.string() })).default([]),
    }),
  ),
  next: z.string().nullable(),
});

export interface KmhflApiAdapterConfig {
  baseUrl: string;
  apiKey: string;
  /** Restrict the import to one county — matches the Phase 0 "one pilot county" scope. */
  county?: string;
}

export class KmhflApiAdapter implements FacilitySourceAdapter {
  constructor(private readonly config: KmhflApiAdapterConfig) {}

  async fetchFacilities(): Promise<RawFacilityRecord[]> {
    const records: RawFacilityRecord[] = [];
    let url: string | null = this.buildUrl();

    while (url) {
      const response: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      if (!response.ok) {
        throw new Error(
          `KMHFL API request failed: ${response.status} ${response.statusText}`,
        );
      }
      const page = kmhflPageSchema.parse(await response.json());

      for (const facility of page.results) {
        records.push({
          kmhflCode: facility.code,
          name: facility.name,
          county: facility.county,
          subCounty: facility.sub_county ?? null,
          lat: facility.latitude,
          lng: facility.longitude,
          phone: facility.phone_number ?? null,
          kephLevel: facility.keph_level ?? null,
          ownership: facility.owner ?? null,
          services: facility.services.map((s) => ({ serviceCode: s.code })),
        });
      }

      url = page.next;
    }

    return records;
  }

  private buildUrl(): string {
    const url = new URL("/api/facilities", this.config.baseUrl);
    if (this.config.county) url.searchParams.set("county", this.config.county);
    return url.toString();
  }
}
