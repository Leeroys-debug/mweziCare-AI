ALTER TABLE "health"."assessments" ADD COLUMN "fired_rule_codes" text[];--> statement-breakpoint
ALTER TABLE "health"."assessments" ADD COLUMN "features" jsonb;
--> statement-breakpoint
-- Hand-added (not drizzle-kit generated): a second, narrowly-scoped
-- permissive SELECT policy for the staff "flagged case samples" review
-- (D2.4) — clinicians need de-identified cross-user read access to
-- assessments, which the existing per-user policy (assessments_user_isolation)
-- can't grant without weakening it. Multiple permissive policies for the
-- same command combine with OR, so a normal request (app.user_id set via
-- withUser, app.staff_review unset) is unaffected; only requests that go
-- through packages/db's withStaffReview (app.staff_review = 'true', no
-- app.user_id) see all rows. Scoped to health.assessments only — never
-- added to symptom_logs/chat_messages/summaries, which hold PII the staff
-- console must never read directly (CLAUDE.md).
CREATE POLICY assessments_staff_review ON health.assessments
  FOR SELECT
  USING (current_setting('app.staff_review', true) = 'true');
