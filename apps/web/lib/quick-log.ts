import type { SymptomLogInput } from "@mwezicare/validation";
import { addDaysIso } from "./date";
import { offlineDb } from "./offline-db";
import { saveLog } from "./sync-engine";
import { generateUuid } from "./uuid";

/** How far back "mark period end" looks for an already-open period's start — long enough for a genuine period, short enough not to sweep in an unrelated earlier one. */
const PERIOD_END_LOOKBACK_DAYS = 10;

const EMPTY_SYMPTOMS = {
  fatigue: false,
  nausea: false,
  painWithBowelMovements: false,
  painWithUrination: false,
  bloodInUrine: false,
  bloating: false,
  bowelHabitChange: false,
};
const EMPTY_IMPACT = {
  missedSchool: false,
  missedWork: false,
  sleepDisrupted: false,
  activitiesLimited: false,
};
const EMPTY_RED_FLAGS = {
  suddenSeverePain: false,
  fainting: false,
  possiblePregnancySuspected: false,
};

/**
 * The local IndexedDB only ever gets written by this device's own saveLog()
 * calls — nothing hydrates it from the server (see sync-engine.ts). So a log
 * that exists server-side but was never created through this browser (a
 * different device, a direct API call, etc.) is invisible locally, and every
 * quick-log action below previously treated such a date as blank — silently
 * re-flipping an already-true periodDay back to true (looked like "remove"
 * did nothing) and overwriting every other field on that date with blank
 * defaults when saving pain. This fetches and caches the server's real
 * state for a date before falling back to "no log exists" for it.
 */
async function getKnownLog(dateIso: string): Promise<SymptomLogInput | null> {
  const local = await offlineDb.logs.where("logDate").equals(dateIso).first();
  if (local) return local;

  const response = await fetch(`/api/v1/logs?from=${dateIso}&to=${dateIso}`);
  if (!response.ok) throw new Error("Failed to load existing log");
  const { logs } = (await response.json()) as {
    logs: (SymptomLogInput & { id?: string })[];
  };
  const [serverLog] = logs;
  if (!serverLog) return null;

  const { id: _id, ...log } = serverLog;
  await offlineDb.logs.put({
    ...log,
    syncStatus: "synced",
    syncedAt: new Date().toISOString(),
  });
  return log;
}

function defaultLog(dateIso: string): SymptomLogInput {
  return {
    clientId: generateUuid(),
    logDate: dateIso,
    periodDay: false,
    bleedingLevel: null,
    painScore: null,
    painLocations: [],
    painTiming: [],
    painPersistsDespiteRelief: null,
    painReliefByMedication: null,
    painDuration: null,
    symptoms: EMPTY_SYMPTOMS,
    impact: EMPTY_IMPACT,
    redFlags: EMPTY_RED_FLAGS,
    notes: null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * One-tap period-day toggle for any date — the Track page's quick action
 * (today) and the calendar's tap-to-log (any date) both use this. Preserves
 * every other field already logged for that date (reads the existing
 * offline record first), or starts from safe all-false/null defaults when
 * that date has no log yet. Returns the new periodDay value.
 */
export async function togglePeriodForDate(dateIso: string): Promise<boolean> {
  const existing = await getKnownLog(dateIso);
  const nextPeriodDay = !(existing?.periodDay ?? false);

  const log: SymptomLogInput = existing
    ? {
        ...existing,
        periodDay: nextPeriodDay,
        updatedAt: new Date().toISOString(),
      }
    : { ...defaultLog(dateIso), periodDay: nextPeriodDay };

  await saveLog(log);
  return nextPeriodDay;
}

/**
 * Marks a period's end: fills every day from the nearest earlier logged
 * period day (within PERIOD_END_LOOKBACK_DAYS) through dateIso as period
 * days, so ending a period doesn't require tapping each day in between one
 * at a time. Falls back to marking just dateIso when no nearby earlier
 * period day is found (e.g. tapping "period end" with no period open yet).
 */
export async function markPeriodEnd(dateIso: string): Promise<void> {
  let start = dateIso;
  for (let i = 1; i <= PERIOD_END_LOOKBACK_DAYS; i++) {
    const candidate = addDaysIso(dateIso, -i);
    const log = await getKnownLog(candidate);
    if (!log?.periodDay) break;
    start = candidate;
  }

  for (let date = start; date <= dateIso; date = addDaysIso(date, 1)) {
    const existing = await getKnownLog(date);
    if (existing?.periodDay) continue;

    const log: SymptomLogInput = existing
      ? { ...existing, periodDay: true, updatedAt: new Date().toISOString() }
      : { ...defaultLog(date), periodDay: true };
    await saveLog(log);
  }
}

/**
 * Quick pain-score log for any date, straight from the calendar — same
 * preserve-everything-else pattern as togglePeriodForDate. A pain score
 * alone can never flip the client-side urgent pre-check (packages/
 * rules-engine's urgentOnlyRuleset only fires on suddenSeverePain,
 * fainting, or possiblePregnancySuspected combined with painScore>=7 —
 * never painScore alone), so there's no safety check to run here.
 */
export async function setPainForDate(
  dateIso: string,
  painScore: number,
): Promise<void> {
  const existing = await getKnownLog(dateIso);

  const log: SymptomLogInput = existing
    ? { ...existing, painScore, updatedAt: new Date().toISOString() }
    : { ...defaultLog(dateIso), painScore };

  await saveLog(log);
}
