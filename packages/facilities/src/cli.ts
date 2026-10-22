import { config } from "dotenv";
import { createDb } from "@mwezicare/db";
import { FileAdapter } from "./adapters/file-adapter";
import { importFacilities } from "./import";

config({ path: "../../.env" });

function parseArgs(argv: string[]): { file: string } {
  const fileIndex = argv.indexOf("--file");
  const file = fileIndex >= 0 ? argv[fileIndex + 1] : undefined;
  if (!file) {
    throw new Error(
      "Usage: pnpm facilities:import -- --file <path-to-csv-or-geojson>",
    );
  }
  return { file };
}

async function main() {
  const { file } = parseArgs(process.argv.slice(2));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const db = createDb(databaseUrl);
  const adapter = new FileAdapter(file);
  const records = await adapter.fetchFacilities();

  console.log(`Importing ${records.length} facilities from ${file}...`);
  const result = await importFacilities(db, records);
  console.log(
    `Done: ${result.facilitiesUpserted} facilities, ${result.servicesUpserted} services upserted.`,
  );
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
