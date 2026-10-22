import { eq, sql } from "drizzle-orm";
import {
  parseAnalyticsEventProps,
  type AnalyticsEventProps,
  type AnalyticsEventType,
} from "@mwezicare/validation";
import type { Database, Tx } from "./client";
import { hmacLookup, type KeyProvider } from "./crypto";
import * as schema from "./schema";

/**
 * Opens a transaction under the write-only `analytics_writer` role
 * (packages/db/drizzle/0009_*.sql — INSERT on analytics.events only, no
 * SELECT) so a bug in this code path can never read analytics back out,
 * let alone any other table. Mirrors withUser/withStaffReview's shape.
 */
export async function withAnalyticsWriter<T>(
  db: Database,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role analytics_writer`);
    return fn(tx);
  });
}

export interface TrackInput<T extends AnalyticsEventType> {
  userId: string;
  eventType: T;
  props: AnalyticsEventProps<T>;
  analyticsKeyProvider: KeyProvider;
}

/**
 * Writes one privacy-preserving analytics event. `pseudoId` is a keyed hash
 * of the user id (never the id itself, never reversible without
 * ANALYTICS_KEY) — see CLAUDE.md's "no sensitive data in logs/analytics".
 * `county`/`age_band`/`locale` are read fresh from the user's own profile
 * here (not taken from the caller), so a route handler can never pass
 * another user's bucket by mistake. `props` is validated against that
 * event type's strict zod schema (packages/validation/analytics-events.ts)
 * before anything is written — unknown/extra fields throw, not get stored.
 */
export async function track<T extends AnalyticsEventType>(
  db: Database,
  input: TrackInput<T>,
): Promise<void> {
  const validatedProps = parseAnalyticsEventProps(input.eventType, input.props);
  const pseudoId = hmacLookup(input.userId, input.analyticsKeyProvider);

  const [profile] = await db
    .select({
      ageBand: schema.profiles.ageBand,
      county: schema.profiles.county,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, input.userId));
  const [user] = await db
    .select({ locale: schema.users.locale })
    .from(schema.users)
    .where(eq(schema.users.id, input.userId));

  await withAnalyticsWriter(db, (tx) =>
    tx.insert(schema.events).values({
      pseudoId,
      eventType: input.eventType,
      county: profile?.county ?? null,
      ageBand: profile?.ageBand ?? null,
      locale: user?.locale ?? null,
      props: validatedProps,
    }),
  );
}

/**
 * Opens a transaction under the existing read-only `analytics_ro` role
 * (packages/db/drizzle/0001_roles_rls_views.sql) — the staff dashboard
 * reads every materialised view through this, never the plain `db` object.
 */
export async function withAnalyticsReader<T>(
  db: Database,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role analytics_ro`);
    return fn(tx);
  });
}

/**
 * Every dashboard-facing materialised view, keyed by a short name used in
 * the API (?view=weekly_active_users etc.) — all share week/county/age_band
 * columns, which is what makes one generic filtered query possible below.
 */
export const DASHBOARD_VIEWS = {
  weekly_county_age: "analytics.mv_weekly_county_age",
  weekly_active_users: "analytics.mv_weekly_active_users",
  logs_per_active_user: "analytics.mv_logs_per_active_user",
  outcome_distribution: "analytics.mv_outcome_distribution",
  referrals_per_outcome: "analytics.mv_referrals_per_outcome",
  knowledge_score_change: "analytics.mv_knowledge_score_change",
  language_split: "analytics.mv_language_split",
  referral_follow_up_rate: "analytics.mv_referral_follow_up_rate",
} as const;
export type DashboardViewName = keyof typeof DASHBOARD_VIEWS;

export interface DashboardViewFilters {
  from?: Date;
  to?: Date;
  county?: string;
  ageBand?: string;
}

/**
 * Filtered rows from one dashboard materialised view — already small-cell
 * suppressed (every view's own HAVING clause), so this never needs to
 * suppress anything itself. Shared by the dashboard JSON API and the CSV
 * export, so both read exactly the same aggregates.
 */
export async function queryDashboardView(
  db: Database,
  view: DashboardViewName,
  filters: DashboardViewFilters = {},
): Promise<Record<string, unknown>[]> {
  const tableName = DASHBOARD_VIEWS[view];
  const conditions = [];
  if (filters.from) conditions.push(sql`week >= ${filters.from}`);
  if (filters.to) conditions.push(sql`week <= ${filters.to}`);
  if (filters.county) conditions.push(sql`county = ${filters.county}`);
  if (filters.ageBand) conditions.push(sql`age_band = ${filters.ageBand}`);
  const whereClause =
    conditions.length > 0
      ? sql`where ${sql.join(conditions, sql` and `)}`
      : sql``;

  return withAnalyticsReader(db, async (tx) => {
    const rows = await tx.execute(
      sql`select * from ${sql.raw(tableName)} ${whereClause} order by week asc`,
    );
    return rows as unknown as Record<string, unknown>[];
  });
}
