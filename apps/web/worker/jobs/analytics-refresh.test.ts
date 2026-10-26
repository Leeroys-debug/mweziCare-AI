import { config } from "dotenv";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, schema, type Database } from "@mwezicare/db";
import { runAnalyticsRefresh } from "./analytics-refresh";

config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;
const db: Database | undefined = databaseUrl
  ? createDb(databaseUrl)
  : undefined;

const TEST_COUNTY = `TimeToCare-Test-${Date.now()}`;
const RULESET_VERSION = 900000 + (Date.now() % 90000);
const USER_COUNT = 10; // matches the small-cell suppression threshold
const DAYS_TO_CARE = 3;

const assessedAt = new Date("2026-01-01T00:00:00.000Z");
const referredAt = new Date(
  assessedAt.getTime() + DAYS_TO_CARE * 24 * 60 * 60 * 1000,
);

const userIds: string[] = [];
let facilityId: string;

describe.skipIf(!db)(
  "runAnalyticsRefresh — analytics.mv_time_to_care_seeking",
  () => {
    beforeAll(async () => {
      await db!
        .insert(schema.rulesets)
        .values({ version: RULESET_VERSION, status: "draft" });

      const [facility] = await db!
        .insert(schema.facilities)
        .values({
          kmhflCode: `time-to-care-test-${Date.now()}`,
          name: "Time To Care Test Facility",
          county: TEST_COUNTY,
        })
        .returning({ id: schema.facilities.id });
      facilityId = facility!.id;

      // 10 users (the small-cell suppression floor) in the same
      // county/age-band bucket, each with an assess_soon assessment
      // followed exactly DAYS_TO_CARE later by a consented referral.
      for (let i = 0; i < USER_COUNT; i++) {
        const [user] = await db!
          .insert(schema.users)
          .values({
            email: `time-to-care-test-${i}-${Date.now()}@example.com`,
          })
          .returning({ id: schema.users.id });
        const userId = user!.id;
        userIds.push(userId);

        await db!.insert(schema.profiles).values({
          userId,
          ageBand: "21-24",
          county: TEST_COUNTY,
        });

        await db!.insert(schema.assessments).values({
          userId,
          rulesetVersion: RULESET_VERSION,
          outcome: "assess_soon",
          reasons: [],
          createdAt: assessedAt,
        });

        await db!.insert(schema.referrals).values({
          userId,
          facilityId,
          followUpConsent: true,
          createdAt: referredAt,
        });
      }
    });

    afterAll(async () => {
      await db!.delete(schema.users).where(inArray(schema.users.id, userIds));
      await db!
        .delete(schema.facilities)
        .where(eq(schema.facilities.id, facilityId));
      await db!
        .delete(schema.rulesets)
        .where(eq(schema.rulesets.version, RULESET_VERSION));
    });

    it("averages the gap between the most recent concerning assessment and the referral, suppressed under 10 users", async () => {
      await runAnalyticsRefresh();

      const rows = await db!.execute<{
        avg_days_to_care_seeking: string;
        distinct_users: string;
        referral_count: string;
      }>(sql`
        select avg_days_to_care_seeking, distinct_users, referral_count
        from analytics.mv_time_to_care_seeking
        where county = ${TEST_COUNTY}
      `);

      expect(rows).toHaveLength(1);
      expect(Number(rows[0]!.distinct_users)).toBe(USER_COUNT);
      expect(Number(rows[0]!.referral_count)).toBe(USER_COUNT);
      expect(Number(rows[0]!.avg_days_to_care_seeking)).toBeCloseTo(
        DAYS_TO_CARE,
        1,
      );
    });
  },
);
