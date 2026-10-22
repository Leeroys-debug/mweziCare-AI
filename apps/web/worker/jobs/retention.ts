import { and, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { createDb, schema, type Database } from "@mwezicare/db";
import { loadServerEnv } from "@mwezicare/validation";
import { deleteObject } from "@/lib/object-storage";
import { logger } from "@/lib/logger";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Chat messages older than CHAT_RETENTION_DAYS (default 90, [LEGAL REVIEW REQUIRED]). */
export async function purgeOldChatMessages(
  db: Database,
  retentionDays: number,
): Promise<number> {
  const cutoff = daysAgo(retentionDays);
  const deleted = await db
    .delete(schema.chatMessages)
    .where(lt(schema.chatMessages.createdAt, cutoff))
    .returning({ id: schema.chatMessages.id });
  return deleted.length;
}

/**
 * Share links (+ their PDFs) that became expired or revoked more than
 * SHARE_LINK_RETENTION_DAYS ago (default 7, [LEGAL REVIEW REQUIRED]) — not
 * `createdAt`, since a link is already unusable from the moment it expires
 * or is revoked. The object-storage bucket also carries a hardcoded 7-day
 * lifecycle rule (lib/object-storage.ts) as a second line of defense, but
 * this delete is the authoritative, env-configurable one.
 */
export async function purgeExpiredShareLinks(
  db: Database,
  retentionDays: number,
): Promise<number> {
  const cutoff = daysAgo(retentionDays);
  const expired = await db
    .select({ id: schema.summaries.id, pdfKey: schema.summaries.pdfKey })
    .from(schema.summaries)
    .where(
      sql`coalesce(${schema.summaries.revokedAt}, ${schema.summaries.expiresAt}) < ${cutoff}`,
    );

  if (expired.length === 0) return 0;

  for (const row of expired) {
    await deleteObject(row.pdfKey).catch((error: unknown) => {
      logger.error(
        { err: error, summaryId: row.id },
        "retention: failed to delete summary PDF",
      );
    });
  }

  await db.delete(schema.summaries).where(
    inArray(
      schema.summaries.id,
      expired.map((row) => row.id),
    ),
  );
  return expired.length;
}

/**
 * Accounts whose deletion was requested (DELETE /api/v1/me) more than
 * ACCOUNT_PURGE_DAYS ago (default 30, [LEGAL REVIEW REQUIRED]) — cascades to
 * every user-scoped table (see packages/db/src/schema's `ON DELETE CASCADE`
 * FKs on identity.profiles/consents/sessions/accounts, health.*,
 * facilities.referrals).
 */
export async function purgeDeletedAccounts(
  db: Database,
  purgeDays: number,
): Promise<number> {
  const cutoff = daysAgo(purgeDays);
  const deleted = await db
    .delete(schema.users)
    .where(
      and(
        isNotNull(schema.users.deletionRequestedAt),
        lt(schema.users.deletionRequestedAt, cutoff),
      ),
    )
    .returning({ id: schema.users.id });
  return deleted.length;
}

/**
 * Audit log entries older than AUDIT_RETENTION_DAYS (default 365,
 * [LEGAL REVIEW REQUIRED]) — audit.access_log is append-only for `app_rw`
 * (packages/db/drizzle/0001_roles_rls_views.sql revokes UPDATE/DELETE from
 * that role), but this job runs on the unrestricted owner connection, same
 * as analytics-refresh.ts's REFRESH MATERIALIZED VIEW calls.
 */
export async function pruneAuditLog(
  db: Database,
  retentionDays: number,
): Promise<number> {
  const cutoff = daysAgo(retentionDays);
  const deleted = await db
    .delete(schema.accessLog)
    .where(lt(schema.accessLog.at, cutoff))
    .returning({ id: schema.accessLog.id });
  return deleted.length;
}

/** Daily pg-boss job (F1 spec) — four independent retention sweeps. */
export async function runRetention(db?: Database): Promise<void> {
  const env = loadServerEnv();
  const database = db ?? createDb(env.DATABASE_URL);

  const chatDeleted = await purgeOldChatMessages(
    database,
    env.CHAT_RETENTION_DAYS,
  );
  const summariesDeleted = await purgeExpiredShareLinks(
    database,
    env.SHARE_LINK_RETENTION_DAYS,
  );
  const accountsDeleted = await purgeDeletedAccounts(
    database,
    env.ACCOUNT_PURGE_DAYS,
  );
  const auditDeleted = await pruneAuditLog(database, env.AUDIT_RETENTION_DAYS);

  logger.info(
    { chatDeleted, summariesDeleted, accountsDeleted, auditDeleted },
    "retention: daily purge complete",
  );
}
