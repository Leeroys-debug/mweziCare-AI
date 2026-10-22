import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { GenericContainer } from "testcontainers";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { createDb, type Database } from "./client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTGRES_BUILD_CONTEXT = path.resolve(
  __dirname,
  "../../../infra/postgres",
);
const IMAGE_TAG = "mwezicare-test-postgres:latest";

// Building the Dockerfile (PostGIS/pgvector/pgcrypto/pg_trgm packages, see
// infra/postgres/Dockerfile) is slow — build it once per test run, not once
// per container, since every test file that imports this module shares the
// same Node process when run together.
let builtImage: Promise<void> | undefined;

function ensureImageBuilt(): Promise<void> {
  if (!builtImage) {
    builtImage = GenericContainer.fromDockerfile(POSTGRES_BUILD_CONTEXT)
      .build(IMAGE_TAG, { deleteOnExit: false })
      .then(() => undefined);
  }
  return builtImage;
}

export interface TestDatabase {
  db: Database;
  connectionUri: string;
  stop: () => Promise<void>;
}

/**
 * Starts a fresh Postgres container from the same custom image
 * docker-compose.yml's `postgres` service builds (so PostGIS/pgvector/
 * pg_trgm/pgcrypto are present), replicates infra/postgres/init's extension
 * setup (that init script only runs via docker-compose's
 * docker-entrypoint-initdb.d mount, which testcontainers doesn't use), then
 * applies every migration before returning — a self-contained database that
 * doesn't depend on the dev docker-compose stack or a `.env`
 * `DATABASE_URL` being up already, unlike the rest of this repo's
 * `describe.skipIf(!db)` tests. Needs a running Docker daemon; where one
 * isn't available (this includes most sandboxed dev environments), calling
 * this throws — same class of pre-existing limitation as every other
 * DB-dependent test here, just surfaced from Docker instead of Postgres.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  await ensureImageBuilt();

  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    IMAGE_TAG,
  )
    .withDatabase("mwezicare_test")
    .withUsername("mwezicare")
    .withPassword("mwezicare")
    .start();

  const extensions = await container.exec([
    "psql",
    "-U",
    "mwezicare",
    "-d",
    "mwezicare_test",
    "-c",
    "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;",
  ]);
  if (extensions.exitCode !== 0) {
    throw new Error(
      `Failed to create extensions in test container: ${extensions.output}`,
    );
  }

  const connectionUri = container.getConnectionUri();
  const db = createDb(connectionUri);
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../drizzle"),
  });

  return {
    db,
    connectionUri,
    stop: async () => {
      await container.stop();
    },
  };
}
