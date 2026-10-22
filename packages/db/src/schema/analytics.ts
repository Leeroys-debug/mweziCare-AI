import { sql } from "drizzle-orm";
import { index, jsonb, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { analyticsSchema } from "./schemas";

/**
 * pseudo_id is a keyed hash with no join key back to identity — see
 * CLAUDE.md's per-user data scoping / no-PII-in-analytics rules.
 * `analytics.mv_weekly_county_age` (small cells under 10 users suppressed)
 * is created by a raw-SQL migration, not this table builder — see
 * packages/db/drizzle/0001_roles_rls_views.sql.
 */
export const events = analyticsSchema.table(
  "events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    pseudoId: text("pseudo_id").notNull(),
    eventType: text("event_type").notNull(),
    county: text("county"),
    ageBand: text("age_band"),
    /** Denormalized at write time (like county/age_band) — powers the language-split view with no identity join. */
    locale: text("locale"),
    props: jsonb("props"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_type_occurred_idx").on(table.eventType, table.occurredAt),
    index("events_county_age_idx").on(table.county, table.ageBand),
  ],
);
