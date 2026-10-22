import { createDb } from "@mwezicare/db";
import { importFacilities, KmhflApiAdapter } from "@mwezicare/facilities";
import { loadServerEnv } from "@mwezicare/validation";

/**
 * Weekly KMHFL import job — uses the (stub, see packages/facilities'
 * KmhflApiAdapter doc comment) API adapter, since the worker has no file to
 * point at. The CLI (`pnpm facilities:import -- --file <path>`) is the path
 * used for a one-off import from a manually downloaded extract.
 */
export async function runFacilitiesImport(): Promise<void> {
  const env = loadServerEnv();
  if (!env.KMHFL_API_BASE_URL || !env.KMHFL_API_KEY) {
    console.warn(
      "facilities.import: KMHFL_API_BASE_URL/KMHFL_API_KEY not configured — skipping scheduled import.",
    );
    return;
  }

  const db = createDb(env.DATABASE_URL);
  const adapter = new KmhflApiAdapter({
    baseUrl: env.KMHFL_API_BASE_URL,
    apiKey: env.KMHFL_API_KEY,
  });

  const records = await adapter.fetchFacilities();
  const result = await importFacilities(db, records);
  console.log(
    `facilities.import: ${result.facilitiesUpserted} facilities, ${result.servicesUpserted} services upserted.`,
  );
}
