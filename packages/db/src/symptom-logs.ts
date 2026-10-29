import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Tx } from "./client";
import { type KeyProvider, decryptField, encryptField } from "./crypto";
import * as schema from "./schema";

export type BleedingLevel =
  (typeof schema.bleedingLevelEnum.enumValues)[number];

export interface SymptomLogInput {
  clientId: string;
  logDate: string;
  periodDay: boolean;
  bleedingLevel?: BleedingLevel | null;
  painScore?: number | null;
  painLocations: string[];
  painTiming?: string[];
  painPersistsDespiteRelief?: boolean | null;
  symptoms: Record<string, boolean>;
  impact: Record<string, boolean>;
  redFlags: Record<string, boolean>;
  notes?: string | null;
  /** Client wall-clock timestamp (ISO string) — last-write-wins compares this. */
  updatedAt: string;
}

export interface SymptomLogRecord {
  id: string;
  clientId: string;
  logDate: string;
  periodDay: boolean;
  bleedingLevel: BleedingLevel | null;
  painScore: number | null;
  painLocations: string[];
  painTiming: string[];
  painPersistsDespiteRelief: boolean | null;
  symptoms: Record<string, boolean>;
  impact: Record<string, boolean>;
  redFlags: Record<string, boolean>;
  notes: string | null;
  updatedAt: string;
}

export type UpsertStatus = "created" | "updated" | "unchanged";

export interface UpsertResult {
  clientId: string;
  status: UpsertStatus;
  log: SymptomLogRecord;
}

type SymptomLogRow = typeof schema.symptomLogs.$inferSelect;

function toRecord(
  row: SymptomLogRow,
  keyProvider: KeyProvider,
): SymptomLogRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    logDate: row.logDate,
    periodDay: row.periodDay,
    bleedingLevel: row.bleedingLevel,
    painScore: row.painScore,
    painLocations: row.painLocations ?? [],
    painTiming: row.painTiming ?? [],
    painPersistsDespiteRelief: row.painPersistsDespiteRelief,
    symptoms: (row.symptoms as Record<string, boolean>) ?? {},
    impact: (row.impact as Record<string, boolean>) ?? {},
    redFlags: (row.redFlags as Record<string, boolean>) ?? {},
    notes: row.notesEnc ? decryptField(row.notesEnc, keyProvider) : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Upserts one daily log by (user_id, log_date) — see packages/db/src/schema/health.ts's
 * comment on symptom_logs' unique index: the DB allows multiple client_ids per
 * date on purpose, and last-write-wins reconciliation happens here, in the app.
 *
 * - No existing row for the date -> insert.
 * - Existing row has the same client_id -> this is a retry of a write already
 *   applied; no-op (keeps batch-sync retries idempotent, no duplicate rows).
 * - Existing row is older than the incoming write -> update in place.
 * - Existing row is newer -> the incoming write lost the race; no-op, and the
 *   caller returns the existing (canonical) record so the client can overwrite
 *   its stale local copy with it.
 */
export async function upsertSymptomLog(
  tx: Tx,
  userId: string,
  log: SymptomLogInput,
  keyProvider: KeyProvider,
): Promise<UpsertResult> {
  const [existing] = await tx
    .select()
    .from(schema.symptomLogs)
    .where(
      and(
        eq(schema.symptomLogs.userId, userId),
        eq(schema.symptomLogs.logDate, log.logDate),
      ),
    )
    .orderBy(desc(schema.symptomLogs.updatedAt))
    .limit(1);

  const notesEnc =
    log.notes && log.notes.length > 0
      ? encryptField(log.notes, keyProvider)
      : null;
  const incomingUpdatedAt = new Date(log.updatedAt);

  if (!existing) {
    const [inserted] = await tx
      .insert(schema.symptomLogs)
      .values({
        userId,
        logDate: log.logDate,
        periodDay: log.periodDay,
        bleedingLevel: log.bleedingLevel ?? null,
        painScore: log.painScore ?? null,
        painLocations: log.painLocations,
        painTiming: log.painTiming ?? [],
        painPersistsDespiteRelief: log.painPersistsDespiteRelief ?? null,
        symptoms: log.symptoms,
        impact: log.impact,
        redFlags: log.redFlags,
        notesEnc,
        clientId: log.clientId,
        updatedAt: incomingUpdatedAt,
        syncedAt: new Date(),
      })
      .returning();
    return {
      clientId: log.clientId,
      status: "created",
      log: toRecord(inserted!, keyProvider),
    };
  }

  if (existing.clientId === log.clientId) {
    return {
      clientId: log.clientId,
      status: "unchanged",
      log: toRecord(existing, keyProvider),
    };
  }

  if (incomingUpdatedAt <= existing.updatedAt) {
    // Incoming write is stale — keep the server's canonical row.
    return {
      clientId: log.clientId,
      status: "unchanged",
      log: toRecord(existing, keyProvider),
    };
  }

  const [updated] = await tx
    .update(schema.symptomLogs)
    .set({
      periodDay: log.periodDay,
      bleedingLevel: log.bleedingLevel ?? null,
      painScore: log.painScore ?? null,
      painLocations: log.painLocations,
      painTiming: log.painTiming ?? [],
      painPersistsDespiteRelief: log.painPersistsDespiteRelief ?? null,
      symptoms: log.symptoms,
      impact: log.impact,
      redFlags: log.redFlags,
      notesEnc,
      clientId: log.clientId,
      updatedAt: incomingUpdatedAt,
      syncedAt: new Date(),
    })
    .where(eq(schema.symptomLogs.id, existing.id))
    .returning();

  return {
    clientId: log.clientId,
    status: "updated",
    log: toRecord(updated!, keyProvider),
  };
}

/** Reads a user's logs in a date range (inclusive), decrypting notes. */
export async function listSymptomLogs(
  tx: Tx,
  userId: string,
  range: { from: string; to: string },
  keyProvider: KeyProvider,
): Promise<SymptomLogRecord[]> {
  const rows = await tx
    .select()
    .from(schema.symptomLogs)
    .where(
      and(
        eq(schema.symptomLogs.userId, userId),
        gte(schema.symptomLogs.logDate, range.from),
        lte(schema.symptomLogs.logDate, range.to),
      ),
    )
    .orderBy(schema.symptomLogs.logDate);
  return rows.map((row) => toRecord(row, keyProvider));
}

/** All of a user's logs, decrypting notes — for the user's own full data export, not bounded by a date range like listSymptomLogs. */
export async function listAllSymptomLogs(
  tx: Tx,
  userId: string,
  keyProvider: KeyProvider,
): Promise<SymptomLogRecord[]> {
  const rows = await tx
    .select()
    .from(schema.symptomLogs)
    .where(eq(schema.symptomLogs.userId, userId))
    .orderBy(schema.symptomLogs.logDate);
  return rows.map((row) => toRecord(row, keyProvider));
}

/**
 * All of a user's logs shaped for @mwezicare/triage (cycle detection,
 * feature extraction) — no notes/decryption needed for triage, so this
 * skips that cost. Sorted ascending by log date.
 */
export async function listTriageLogs(tx: Tx, userId: string) {
  const rows = await tx
    .select({
      logDate: schema.symptomLogs.logDate,
      periodDay: schema.symptomLogs.periodDay,
      bleedingLevel: schema.symptomLogs.bleedingLevel,
      painScore: schema.symptomLogs.painScore,
      symptoms: schema.symptomLogs.symptoms,
      impact: schema.symptomLogs.impact,
      redFlags: schema.symptomLogs.redFlags,
    })
    .from(schema.symptomLogs)
    .where(eq(schema.symptomLogs.userId, userId))
    .orderBy(schema.symptomLogs.logDate);

  return rows.map((row) => ({
    logDate: row.logDate,
    periodDay: row.periodDay,
    bleedingLevel: row.bleedingLevel,
    painScore: row.painScore,
    symptoms: (row.symptoms as Record<string, boolean>) ?? {},
    impact: (row.impact as Record<string, boolean>) ?? {},
    redFlags: (row.redFlags as Record<string, boolean>) ?? {},
  }));
}
