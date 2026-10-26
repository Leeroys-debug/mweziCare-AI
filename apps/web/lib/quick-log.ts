import type { SymptomLogInput } from "@mwezicare/validation";
import { offlineDb } from "./offline-db";
import { saveLog } from "./sync-engine";

const EMPTY_SYMPTOMS = {
  fatigue: false,
  nausea: false,
  painWithBowelMovements: false,
  painWithUrination: false,
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
 * One-tap period-day toggle for the Track page's quick actions — preserves
 * every other field already logged for today (reads the existing offline
 * record first), or starts from safe all-false/null defaults when today has
 * no log yet. Returns the new periodDay value.
 */
export async function toggleTodayPeriod(todayIso: string): Promise<boolean> {
  const existing = await offlineDb.logs
    .where("logDate")
    .equals(todayIso)
    .first();
  const nextPeriodDay = !(existing?.periodDay ?? false);

  const log: SymptomLogInput = existing
    ? {
        ...existing,
        periodDay: nextPeriodDay,
        updatedAt: new Date().toISOString(),
      }
    : {
        clientId: crypto.randomUUID(),
        logDate: todayIso,
        periodDay: nextPeriodDay,
        bleedingLevel: null,
        painScore: null,
        painLocations: [],
        painTiming: [],
        painPersistsDespiteRelief: null,
        symptoms: EMPTY_SYMPTOMS,
        impact: EMPTY_IMPACT,
        redFlags: EMPTY_RED_FLAGS,
        notes: null,
        updatedAt: new Date().toISOString(),
      };

  await saveLog(log);
  return nextPeriodDay;
}
