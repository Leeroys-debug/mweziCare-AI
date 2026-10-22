-- Hand-added (not drizzle-kit generated): fixes a latent bug in every
-- health.* user-isolation policy from 0001_roles_rls_views.sql and
-- 0009_loud_revanche.sql. `set_config('app.user_id', ..., true)` (withUser,
-- packages/db/src/client.ts) is *local* to its transaction, but on COMMIT
-- Postgres doesn't revert a custom GUC to NULL — it collapses to '' (empty
-- string) for the rest of that physical connection. postgres.js pools
-- connections, so any later transaction on that same connection that never
-- sets app.user_id (e.g. withStaffReview, which only sets app.staff_review)
-- hits `current_setting('app.user_id', true)::uuid` with '' and gets
-- "invalid input syntax for type uuid" — surfaced by packages/db/src/rls.test.ts
-- ("withStaffReview sees assessments across every user"). Only
-- health.assessments has a second permissive policy to force that
-- evaluation today, but every one of these policies has the same latent
-- bug, so all are fixed the same way: NULLIF collapses '' back to NULL
-- before the cast, same as "never set".
ALTER POLICY cycles_user_isolation ON health.cycles
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY symptom_logs_user_isolation ON health.symptom_logs
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY assessments_user_isolation ON health.assessments
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY chat_sessions_user_isolation ON health.chat_sessions
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY chat_messages_user_isolation ON health.chat_messages
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY summaries_user_isolation ON health.summaries
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

ALTER POLICY quiz_attempts_user_isolation ON health.quiz_attempts
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
