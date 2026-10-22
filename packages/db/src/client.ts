import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(connectionString: string) {
  // Postgres NOTICE messages (e.g. "truncate cascades to table ...") are
  // informational, not errors — silence them instead of console-logging.
  const client = postgres(connectionString, { onnotice: () => {} });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

type TransactionCallback = Parameters<Database["transaction"]>[0];
export type Tx = Parameters<TransactionCallback>[0];

/**
 * Opens a transaction, switches to the least-privilege `app_rw` role, and
 * sets `app.user_id` for its duration, so every row-level-security policy
 * on health.* tables (keyed to current_setting('app.user_id')) scopes
 * queries to this user — even if the pool connects as the table owner,
 * which RLS would otherwise bypass. Use this for every query that touches
 * a user's own health data — see CLAUDE.md's per-user data scoping rule.
 */
export async function withUser<T>(
  db: Database,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_rw`);
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    return fn(tx);
  });
}

/**
 * Opens a transaction under the narrowly-scoped `assessments_staff_review`
 * policy (packages/db/drizzle/0008_*.sql) instead of a specific user's id —
 * only health.assessments grants this bypass, and only for SELECT. Use
 * this (never withUser, never the plain db) for the staff flagged-case-
 * samples review, which needs de-identified reads across all users.
 */
export async function withStaffReview<T>(
  db: Database,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_rw`);
    await tx.execute(sql`select set_config('app.staff_review', 'true', true)`);
    return fn(tx);
  });
}
