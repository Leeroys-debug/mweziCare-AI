-- Least-privilege roles, row-level security on health.*, the weekly
-- analytics materialised view, and append-only grants on audit.access_log.
-- See CLAUDE.md "Non-negotiable safety and privacy rules" and the
-- architecture doc's "Security, privacy and compliance" section.

-- --- Roles --------------------------------------------------------------
-- app_rw / analytics_ro are granted to CURRENT_USER (whoever runs
-- migrations) so a single dev/pilot DB user can SET ROLE into them. In
-- production, grant them to the app's actual connection user and a
-- dedicated reporting user instead.
CREATE ROLE app_rw NOLOGIN;
CREATE ROLE analytics_ro NOLOGIN;
GRANT app_rw TO CURRENT_USER;
GRANT analytics_ro TO CURRENT_USER;

GRANT USAGE ON SCHEMA identity, health, facilities, clinical TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES
  IN SCHEMA identity, health, facilities, clinical TO app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA identity, health, facilities, clinical
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;

-- Append-only: app_rw can write and read audit entries, never change them.
GRANT USAGE ON SCHEMA audit TO app_rw;
GRANT SELECT, INSERT ON audit.access_log TO app_rw;

GRANT USAGE ON SCHEMA analytics TO analytics_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO analytics_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT ON TABLES TO analytics_ro;

-- --- Row-level security on health.* -------------------------------------
-- packages/db's withUser() helper does `SET LOCAL ROLE app_rw` plus
-- `set_config('app.user_id', ...)` per transaction, so every query in a
-- request runs as a non-owner role with these policies applied.
ALTER TABLE health.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.cycles FORCE ROW LEVEL SECURITY;
CREATE POLICY cycles_user_isolation ON health.cycles
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE health.symptom_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.symptom_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY symptom_logs_user_isolation ON health.symptom_logs
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE health.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.assessments FORCE ROW LEVEL SECURITY;
CREATE POLICY assessments_user_isolation ON health.assessments
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE health.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.chat_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY chat_sessions_user_isolation ON health.chat_sessions
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE health.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.chat_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_user_isolation ON health.chat_messages
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

ALTER TABLE health.summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE health.summaries FORCE ROW LEVEL SECURITY;
CREATE POLICY summaries_user_isolation ON health.summaries
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

-- --- Weekly impact-dashboard materialised view ---------------------------
-- Built only on analytics.events (pseudonymised, no join back to identity);
-- small cells (< 10 distinct users) are suppressed outright, not just
-- masked, so no partial-count re-identification is possible. Refreshed
-- nightly by pg-boss (see architecture doc "Runtime components").
CREATE MATERIALIZED VIEW analytics.mv_weekly_county_age AS
SELECT
  date_trunc('week', occurred_at) AS week,
  county,
  age_band,
  event_type,
  count(*) AS event_count,
  count(DISTINCT pseudo_id) AS unique_users
FROM analytics.events
GROUP BY 1, 2, 3, 4
HAVING count(DISTINCT pseudo_id) >= 10;

CREATE UNIQUE INDEX mv_weekly_county_age_idx
  ON analytics.mv_weekly_county_age (week, county, age_band, event_type);
