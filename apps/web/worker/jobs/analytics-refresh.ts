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

// Reads health.assessments (FORCE ROW LEVEL SECURITY, see
// packages/db/drizzle/0014_*.sql's comment) to compute time-to-care-seeking,
// so its refresh must run with the app.staff_review session GUC set — a
// plain refresh would silently see zero assessment rows and produce an
// empty view, not an error.
const STAFF_REVIEW_MATERIALIZED_VIEWS = ["analytics.mv_time_to_care_seeking"];

/**
 * Nightly refresh of every impact-dashboard materialised view (E1 spec).
 * CONCURRENTLY avoids locking the view against reads while it rebuilds —
 * every view here has a unique index (packages/db/drizzle/0001, 0009 and
 * 0014 migrations), which CONCURRENTLY requires.
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

  for (const view of STAFF_REVIEW_MATERIALIZED_VIEWS) {
    try {
      // Only the GUC, not SET LOCAL ROLE app_rw (unlike withStaffReview) —
      // REFRESH MATERIALIZED VIEW requires the connection to still be the
      // view's owning role, which app_rw isn't.
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select set_config('app.staff_review', 'true', true)`,
        );
        await tx.execute(
          sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`),
        );
      });
      console.log(`analytics.refresh: ${view} refreshed.`);
    } catch (error) {
      console.error(`analytics.refresh: ${view} failed`, error);
    }
  }
}
