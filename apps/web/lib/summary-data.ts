import { desc, eq } from "drizzle-orm";
import { listTriageLogs, schema, withUser, type Database } from "@mwezicare/db";
import {
  buildSummaryData,
  deriveCycles,
  type Cycle,
  type SummaryData,
} from "@mwezicare/triage";

/**
 * Turns a stored `summaries.period` value back into concrete bounds.
 * `3_cycles`/`6_cycles` are resolved against the user's *current* cycle
 * history — health.summaries intentionally stores only metadata (not a
 * data snapshot), so a summary viewed well after creation may reflect
 * newer logs than existed at creation time. In practice summaries are
 * viewed within hours/days of creation, so this is a rare, acceptable gap.
 */
export function parsePeriodToRange(
  period: string,
  cycles: Cycle[],
): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (period.startsWith("custom:")) {
    const [from, to] = period.slice("custom:".length).split("..");
    return { from: from ?? today, to: to ?? today };
  }
  const n = period === "3_cycles" ? 3 : 6;
  const windowCycles = cycles.slice(-n);
  return { from: windowCycles[0]?.startDate ?? today, to: today };
}

export interface LoadedSummary {
  data: SummaryData;
  ageBand: string;
}

/** Recomputes a user's SummaryData for a stored period — shared by the create route and the public/preview views. */
export async function loadSummaryDataForUser(
  db: Database,
  userId: string,
  period: string,
): Promise<LoadedSummary> {
  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, userId));

  const logs = await withUser(db, userId, (tx) => listTriageLogs(tx, userId));
  const cycles = deriveCycles(logs);
  const range = parsePeriodToRange(period, cycles);

  const [assessmentRow] = await withUser(db, userId, (tx) =>
    tx
      .select()
      .from(schema.assessments)
      .where(eq(schema.assessments.userId, userId))
      .orderBy(desc(schema.assessments.createdAt))
      .limit(1),
  );
  const assessment = assessmentRow
    ? {
        outcome: assessmentRow.outcome,
        reasons: assessmentRow.reasons as { en: string; sw: string }[],
        rulesetVersion: assessmentRow.rulesetVersion,
      }
    : null;

  return {
    data: buildSummaryData(logs, cycles, assessment, range),
    ageBand: profile?.ageBand ?? "unknown",
  };
}
