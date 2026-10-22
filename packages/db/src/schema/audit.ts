import { sql } from "drizzle-orm";
import { index, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { auditSchema } from "./schemas";
import { users } from "./identity";

/**
 * Append-only — every staff read of user health data is logged here (see
 * CLAUDE.md). UPDATE/DELETE are additionally revoked for app_rw in
 * packages/db/drizzle/0001_roles_rls_views.sql.
 */
export const accessLog = auditSchema.table(
  "access_log",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    ipHash: text("ip_hash"),
  },
  (table) => [index("access_log_actor_idx").on(table.actorId, table.at)],
);
