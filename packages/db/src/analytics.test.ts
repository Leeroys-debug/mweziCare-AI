import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import { track } from "./analytics";
import { EnvKeyProvider, hmacLookup } from "./crypto";
import * as schema from "./schema";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;
const analyticsKeyProvider = process.env.ANALYTICS_KEY
  ? new EnvKeyProvider(process.env.ANALYTICS_KEY)
  : undefined;

describe.skipIf(!db)("analytics small-cell suppression", () => {
  const suppressedCounty = `Suppressed-Test-${Date.now()}`;
  const visibleCounty = `Visible-Test-${Date.now()}`;

  afterAll(async () => {
    await db!
      .delete(schema.events)
      .where(sql`county in (${suppressedCounty}, ${visibleCounty})`);
  });

  it("drops a cell with fewer than 10 distinct pseudo_ids, keeps one with >= 10", async () => {
    // 5 distinct pseudo_ids for the "suppressed" county — below the threshold.
    await db!.insert(schema.events).values(
      Array.from({ length: 5 }, (_, i) => ({
        pseudoId: `suppressed-user-${i}`,
        eventType: "log_saved",
        county: suppressedCounty,
        ageBand: "18-20",
        props: {},
      })),
    );
    // 12 distinct pseudo_ids for the "visible" county — above the threshold.
    await db!.insert(schema.events).values(
      Array.from({ length: 12 }, (_, i) => ({
        pseudoId: `visible-user-${i}`,
        eventType: "log_saved",
        county: visibleCounty,
        ageBand: "18-20",
        props: {},
      })),
    );

    await db!.execute(
      sql`refresh materialized view analytics.mv_weekly_active_users`,
    );

    const suppressedRows = await db!.execute(sql`
      select * from analytics.mv_weekly_active_users where county = ${suppressedCounty}
    `);
    expect(suppressedRows).toHaveLength(0);

    const visibleRows = await db!.execute<{ active_users: number }>(sql`
      select * from analytics.mv_weekly_active_users where county = ${visibleCounty}
    `);
    expect(visibleRows).toHaveLength(1);
    expect(Number(visibleRows[0]!.active_users)).toBe(12);
  });
});

describe.skipIf(!db || !analyticsKeyProvider)("track()", () => {
  afterAll(async () => {
    await db!
      .delete(schema.events)
      .where(sql`event_type = 'summary_created' and props = '{}'::jsonb`);
  });

  it("writes a pseudo_id that is a keyed hash, never the raw user id", async () => {
    const userIdA = "11111111-1111-1111-1111-111111111111";
    const userIdB = "22222222-2222-2222-2222-222222222222";

    await track(db!, {
      userId: userIdA,
      eventType: "summary_created",
      props: {},
      analyticsKeyProvider: analyticsKeyProvider!,
    });

    const [row] = await db!.execute<{ pseudo_id: string }>(sql`
      select pseudo_id from analytics.events
      where event_type = 'summary_created'
      order by occurred_at desc
      limit 1
    `);

    expect(row!.pseudo_id).not.toBe(userIdA);
    expect(row!.pseudo_id).toBe(hmacLookup(userIdA, analyticsKeyProvider!));
    // Two different users must never collide on the same pseudonym.
    expect(hmacLookup(userIdA, analyticsKeyProvider!)).not.toBe(
      hmacLookup(userIdB, analyticsKeyProvider!),
    );
  });

  it("rejects an event whose props don't match that event type's schema", async () => {
    await expect(
      track(db!, {
        userId: "11111111-1111-1111-1111-111111111111",
        eventType: "summary_created",
        props: { notAllowed: true } as object,
        analyticsKeyProvider: analyticsKeyProvider!,
      }),
    ).rejects.toThrow();
  });
});
