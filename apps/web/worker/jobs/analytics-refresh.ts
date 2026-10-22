import { sql } from "drizzle-orm";
import { createDb } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";

const MATERIALIZED_VIEWS = [
  "analytics.mv_weekly_county_age",
  "analytics.mv_weekly_active_users",
  "analytics.mv_logs_per_active_user",
  "analytics.mv_outcome_distribution",
  "analytics.mv_referrals_per_outcome",
  "analytics.mv_knowledge_score_change",
  "analytics.mv_language_split",
  "analytics.mv_referral_follow_up_rate",
];

/**
 * Nightly refresh of every impact-dashboard materialised view (E1 spec).
 * CONCURRENTLY avoids locking the view against reads while it rebuilds —
 * every view here has a unique index (packages/db/drizzle/0001 and 0009
 * migrations), which CONCURRENTLY requires.
 */
export async function runAnalyticsRefresh(): Promise<void> {
  const env = loadServerEnv();
  const db = createDb(env.DATABASE_URL);

  for (const view of MATERIALIZED_VIEWS) {
    try {
      await db.execute(
        sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`),
      );
      console.log(`analytics.refresh: ${view} refreshed.`);
    } catch (error) {
      console.error(`analytics.refresh: ${view} failed`, error);
    }
  }
}
