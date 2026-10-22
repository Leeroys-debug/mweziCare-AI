CREATE TYPE "health"."quiz_prompt_kind" AS ENUM('onboarding', 'day30');--> statement-breakpoint
CREATE TABLE "health"."quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prompt_kind" "health"."quiz_prompt_kind" NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics"."events" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "health"."quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_user_prompt_kind_idx" ON "health"."quiz_attempts" USING btree ("user_id","prompt_kind");
--> statement-breakpoint
-- Hand-added (not drizzle-kit generated): quiz_attempts is per-user health
-- data like every other health.* table, so it gets the same RLS policy
-- (packages/db's withUser sets app.user_id per transaction — see
-- 0001_roles_rls_views.sql for the pattern this mirrors).
ALTER TABLE "health"."quiz_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health"."quiz_attempts" FORCE ROW LEVEL SECURITY;
CREATE POLICY quiz_attempts_user_isolation ON health.quiz_attempts
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);
--> statement-breakpoint
-- Write-only analytics role (E1 spec: "writes through the analytics_ro/
-- analytics_writer role, never joining identity"). Deliberately NOT given
-- SELECT — a compromised write path still can't read analytics back out.
-- Separate from the existing read-only analytics_ro (0001_roles_rls_views.sql).
CREATE ROLE analytics_writer NOLOGIN;
GRANT analytics_writer TO CURRENT_USER;
GRANT USAGE ON SCHEMA analytics TO analytics_writer;
GRANT INSERT ON analytics.events TO analytics_writer;
--> statement-breakpoint
-- Impact-dashboard materialised views (E1 spec), refreshed nightly by
-- apps/web/worker/jobs/analytics-refresh.ts. All but the last are purely
-- event-sourced from analytics.events (no identity join, ever) and follow
-- mv_weekly_county_age's small-cell suppression pattern (0001_roles_rls_views.sql):
-- any (week, county, age_band[, ...]) combination with fewer than 10
-- distinct pseudo_ids is dropped outright, not just masked.
CREATE MATERIALIZED VIEW analytics.mv_weekly_active_users AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  count(DISTINCT pseudo_id) AS active_users
FROM analytics.events
GROUP BY 1, 2, 3
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_weekly_active_users_idx
  ON analytics.mv_weekly_active_users (week, county, age_band);
--> statement-breakpoint
CREATE MATERIALIZED VIEW analytics.mv_logs_per_active_user AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  count(DISTINCT pseudo_id) AS active_users,
  count(*) FILTER (WHERE event_type = 'log_saved')::numeric
    / NULLIF(count(DISTINCT pseudo_id), 0) AS logs_per_active_user
FROM analytics.events
GROUP BY 1, 2, 3
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_logs_per_active_user_idx
  ON analytics.mv_logs_per_active_user (week, county, age_band);
--> statement-breakpoint
CREATE MATERIALIZED VIEW analytics.mv_outcome_distribution AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  props->>'outcome' AS outcome,
  count(*) AS assessment_count,
  count(DISTINCT pseudo_id) AS distinct_users
FROM analytics.events
WHERE event_type = 'assessment_generated'
GROUP BY 1, 2, 3, 4
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_outcome_distribution_idx
  ON analytics.mv_outcome_distribution (week, county, age_band, outcome);
--> statement-breakpoint
CREATE MATERIALIZED VIEW analytics.mv_referrals_per_outcome AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  coalesce(props->>'outcome', 'unknown') AS outcome,
  count(*) AS referral_count,
  count(DISTINCT pseudo_id) AS distinct_users
FROM analytics.events
WHERE event_type = 'referral_recorded'
GROUP BY 1, 2, 3, 4
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_referrals_per_outcome_idx
  ON analytics.mv_referrals_per_outcome (week, county, age_band, outcome);
--> statement-breakpoint
CREATE MATERIALIZED VIEW analytics.mv_knowledge_score_change AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  props->>'scoreChangeBand' AS score_change_band,
  count(*) AS attempt_count,
  count(DISTINCT pseudo_id) AS distinct_users
FROM analytics.events
WHERE event_type = 'knowledge_quiz_completed' AND props->>'promptKind' = 'day30'
GROUP BY 1, 2, 3, 4
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_knowledge_score_change_idx
  ON analytics.mv_knowledge_score_change (week, county, age_band, score_change_band);
--> statement-breakpoint
CREATE MATERIALIZED VIEW analytics.mv_language_split AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  locale,
  count(DISTINCT pseudo_id) AS distinct_users
FROM analytics.events
WHERE locale IS NOT NULL
GROUP BY 1, 2, 3, 4
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_language_split_idx
  ON analytics.mv_language_split (week, county, age_band, locale);
--> statement-breakpoint
-- The one deliberate exception to "event-sourced, no identity join": referral
-- follow-up is tracked on facilities.referrals (follow_up_consent/
-- follow_up_status), not as an analytics event, so measuring it needs a join
-- to identity.profiles for county/age-band bucketing. Scoped to
-- follow_up_consent = true rows only ("(consented only)" in the spec) and
-- still suppressed under 10 distinct users.
CREATE MATERIALIZED VIEW analytics.mv_referral_follow_up_rate AS
SELECT
  date_trunc('week', r.created_at) AS week,
  p.county AS county,
  p.age_band AS age_band,
  count(*) AS consented_referrals,
  count(*) FILTER (WHERE r.follow_up_status = 'completed') AS completed_follow_ups,
  count(DISTINCT r.user_id) AS distinct_users
FROM facilities.referrals r
JOIN identity.profiles p ON p.user_id = r.user_id
WHERE r.follow_up_consent = true
GROUP BY 1, 2, 3
HAVING count(DISTINCT r.user_id) >= 10;

CREATE UNIQUE INDEX mv_referral_follow_up_rate_idx
  ON analytics.mv_referral_follow_up_rate (week, county, age_band);