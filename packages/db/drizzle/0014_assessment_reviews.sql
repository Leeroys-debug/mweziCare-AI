CREATE TYPE "health"."escalation_verdict" AS ENUM('appropriate', 'inappropriate', 'uncertain');--> statement-breakpoint
CREATE TABLE "health"."assessment_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"reviewed_by" uuid NOT NULL,
	"verdict" "health"."escalation_verdict" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "health"."assessment_reviews" ADD CONSTRAINT "assessment_reviews_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "health"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health"."assessment_reviews" ADD CONSTRAINT "assessment_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assessment_reviews_assessment_idx" ON "health"."assessment_reviews" USING btree ("assessment_id");
--> statement-breakpoint
-- Hand-added (not drizzle-kit generated): impact-dashboard materialised
-- view for the "time from a concerning symptom pattern to care-seeking"
-- pilot metric (UNICEF Femtech proposal §10), refreshed nightly by
-- apps/web/worker/jobs/analytics-refresh.ts alongside the others
-- (0009_loud_revanche.sql). For each consented referral (same
-- follow_up_consent = true scoping as mv_referral_follow_up_rate — this
-- view, like that one, needs to read raw facilities.referrals/
-- identity.profiles rather than the pre-pseudonymized analytics.events),
-- finds the most recent assess_soon/urgent assessment for that user at or
-- before the referral and averages the gap in days, bucketed and
-- small-cell suppressed the same way as mv_referral_follow_up_rate.
--
-- health.assessments has FORCE ROW LEVEL SECURITY (0001_roles_rls_views.sql)
-- with no policy granting a nightly job cross-user read access by default —
-- only the narrowly-scoped assessments_staff_review policy (0008_*.sql) can
-- see every user's rows, gated on the app.staff_review session GUC. The
-- refresh job must therefore run this view's REFRESH inside a transaction
-- that sets app.staff_review = true (packages/db/src/client.ts's
-- withStaffReview sets this plus SET LOCAL ROLE app_rw — but REFRESH
-- MATERIALIZED VIEW requires the view's owning role, so the refresh job
-- sets only the GUC, not the role, for this one view).
CREATE MATERIALIZED VIEW analytics.mv_time_to_care_seeking AS
SELECT
  date_trunc('week', r.created_at) AS week,
  p.county AS county,
  p.age_band AS age_band,
  avg(extract(epoch FROM (r.created_at - a.assessed_at)) / 86400.0) AS avg_days_to_care_seeking,
  count(*) AS referral_count,
  count(DISTINCT r.user_id) AS distinct_users
FROM facilities.referrals r
JOIN identity.profiles p ON p.user_id = r.user_id
JOIN LATERAL (
  SELECT a.created_at AS assessed_at
  FROM health.assessments a
  WHERE a.user_id = r.user_id
    AND a.outcome IN ('assess_soon', 'urgent')
    AND a.created_at <= r.created_at
  ORDER BY a.created_at DESC
  LIMIT 1
) a ON true
WHERE r.follow_up_consent = true
GROUP BY 1, 2, 3
HAVING count(DISTINCT r.user_id) >= 10;

CREATE UNIQUE INDEX mv_time_to_care_seeking_idx
  ON analytics.mv_time_to_care_seeking (week, county, age_band);