import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import { consumeRateLimitToken } from "./rate-limit";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

describe.skipIf(!db)("consumeRateLimitToken", () => {
  const key = `test:rate-limit:${Date.now()}`;

  afterAll(async () => {
    await db!.execute(
      sql`delete from identity.rate_limit_buckets where key = ${key}`,
    );
  });

  it("allows requests up to capacity, then denies", async () => {
    const database = db!;
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await consumeRateLimitToken(database, key, 3, 0));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
  });

  it("refills over time", async () => {
    const database = db!;
    const refillKey = `${key}:refill`;
    // Capacity 1, refilling fast (10 tokens/sec) so a short wait refills it.
    const first = await consumeRateLimitToken(database, refillKey, 1, 10);
    expect(first.allowed).toBe(true);
    const second = await consumeRateLimitToken(database, refillKey, 1, 10);
    expect(second.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 200));
    const third = await consumeRateLimitToken(database, refillKey, 1, 10);
    expect(third.allowed).toBe(true);

    await database.execute(
      sql`delete from identity.rate_limit_buckets where key = ${refillKey}`,
    );
  });
});
