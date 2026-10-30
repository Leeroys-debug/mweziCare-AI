import {
  cycleDateRange,
  logsInRange,
  type Cycle,
  type PeriodDayLog,
} from "./cycles";

export interface TriageLog extends PeriodDayLog {
  bleedingLevel?: string | null;
  painScore?: number | null;
  symptoms?: {
    painWithBowelMovements?: boolean;
    painWithUrination?: boolean;
    bloodInUrine?: boolean;
  } | null;
  impact?: {
    missedSchool?: boolean;
    missedWork?: boolean;
    sleepDisrupted?: boolean;
    activitiesLimited?: boolean;
  } | null;
}

const HEAVY_BLEEDING_LEVELS = new Set(["heavy", "very_heavy"]);

function linearRegressionSlope(points: { x: number; y: number }[]): number {
  if (points.length < 2) return 0;
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return 0; // all same x (shouldn't happen with distinct dates)
  return (n * sumXY - sumX * sumY) / denominator;
}

function windowFeatures(
  logs: TriageLog[],
  cycles: Cycle[],
  windowSize: number,
) {
  const windowCycles = cycles.slice(-windowSize);
  const sortedLogs = [...logs].sort((a, b) => (a.logDate < b.logDate ? -1 : 1));
  const windowEnd = sortedLogs.at(-1)?.logDate;

  if (windowCycles.length === 0 || !windowEnd) {
    return {
      cyclesWithMaxPainGte7: 0,
      missedSchoolOrWorkOrSleepOrActivityDays: 0,
      painDaysOutsideMenstruation: 0,
      anyBowelOrUrinarySymptom: false,
      heavyOrVeryHeavyBleedingDays: 0,
      periodsLongerThan7Days: 0,
      bleedingBetweenPeriods: false,
      painTrendSlope: 0,
      cycleLengthVariabilityDays: 0,
    };
  }

  const windowStart = windowCycles[0]!.startDate;
  const logsInWindow = logsInRange(sortedLogs, {
    from: windowStart,
    to: windowEnd,
  });

  const cyclesWithMaxPainGte7 = windowCycles.reduce((count, _cycle, i) => {
    const cycleIndex = cycles.indexOf(windowCycles[i]!);
    const range = cycleDateRange(cycles, cycleIndex, windowEnd);
    const maxPain = logsInRange(sortedLogs, range).reduce(
      (max, log) => Math.max(max, log.painScore ?? 0),
      0,
    );
    return maxPain >= 7 ? count + 1 : count;
  }, 0);

  const missedSchoolOrWorkOrSleepOrActivityDays = logsInWindow.filter(
    (log) =>
      log.impact?.missedSchool ||
      log.impact?.missedWork ||
      log.impact?.sleepDisrupted ||
      log.impact?.activitiesLimited,
  ).length;

  const painDaysOutsideMenstruation = logsInWindow.filter(
    (log) => !log.periodDay && (log.painScore ?? 0) > 0,
  ).length;

  // NICE NG73 1.3.1 groups painful bowel movements (dyschezia) with
  // urinary symptoms — "blood in the urine or pain passing urine" — as
  // symptoms to suspect endometriosis on, so all three feed one feature.
  const anyBowelOrUrinarySymptom = logsInWindow.some(
    (log) =>
      log.symptoms?.painWithBowelMovements ||
      log.symptoms?.painWithUrination ||
      log.symptoms?.bloodInUrine,
  );

  const heavyOrVeryHeavyBleedingDays = logsInWindow.filter(
    (log) => log.bleedingLevel && HEAVY_BLEEDING_LEVELS.has(log.bleedingLevel),
  ).length;

  const periodsLongerThan7Days = windowCycles.filter(
    (c) => c.periodLengthDays > 7,
  ).length;

  const bleedingBetweenPeriods = logsInWindow.some(
    (log) =>
      !log.periodDay && log.bleedingLevel && log.bleedingLevel !== "none",
  );

  const painPoints = logsInWindow
    .filter((log) => log.painScore != null)
    .map((log, i) => ({ x: i, y: log.painScore! }));
  const painTrendSlope = linearRegressionSlope(painPoints);

  // Spread between the shortest and longest *completed* cycle in this
  // window — needs at least 2 completed cycles to mean anything, else 0
  // (an ongoing/most-recent cycle always has cycleLengthDays: null, see
  // packages/triage/src/cycles.ts).
  const completedCycleLengths = windowCycles
    .map((c) => c.cycleLengthDays)
    .filter((length): length is number => length !== null);
  const cycleLengthVariabilityDays =
    completedCycleLengths.length >= 2
      ? Math.max(...completedCycleLengths) - Math.min(...completedCycleLengths)
      : 0;

  return {
    cyclesWithMaxPainGte7,
    missedSchoolOrWorkOrSleepOrActivityDays,
    painDaysOutsideMenstruation,
    anyBowelOrUrinarySymptom,
    heavyOrVeryHeavyBleedingDays,
    periodsLongerThan7Days,
    bleedingBetweenPeriods,
    painTrendSlope,
    cycleLengthVariabilityDays,
  };
}

/**
 * Flat feature record fed to @mwezicare/rules-engine's evaluate(). Every
 * metric is computed over both the last-3 and last-6 cycle windows,
 * suffixed accordingly — matching the feature names referenced by
 * packages/rules-engine/src/rulesets/draft-v1.ts.
 */
export function extractFeatures(
  logs: TriageLog[],
  cycles: Cycle[],
): Record<string, number | boolean> {
  const last3 = windowFeatures(logs, cycles, 3);
  const last6 = windowFeatures(logs, cycles, 6);

  return {
    cyclesWithMaxPainGte7_last3: last3.cyclesWithMaxPainGte7,
    cyclesWithMaxPainGte7_last6: last6.cyclesWithMaxPainGte7,
    missedSchoolOrWorkOrSleepOrActivityDays_last3:
      last3.missedSchoolOrWorkOrSleepOrActivityDays,
    missedSchoolOrWorkOrSleepOrActivityDays_last6:
      last6.missedSchoolOrWorkOrSleepOrActivityDays,
    painDaysOutsideMenstruation_last3: last3.painDaysOutsideMenstruation,
    painDaysOutsideMenstruation_last6: last6.painDaysOutsideMenstruation,
    anyBowelOrUrinarySymptom_last3: last3.anyBowelOrUrinarySymptom,
    anyBowelOrUrinarySymptom_last6: last6.anyBowelOrUrinarySymptom,
    heavyOrVeryHeavyBleedingDays_last3: last3.heavyOrVeryHeavyBleedingDays,
    heavyOrVeryHeavyBleedingDays_last6: last6.heavyOrVeryHeavyBleedingDays,
    periodsLongerThan7Days_last3: last3.periodsLongerThan7Days,
    periodsLongerThan7Days_last6: last6.periodsLongerThan7Days,
    bleedingBetweenPeriods_last3: last3.bleedingBetweenPeriods,
    bleedingBetweenPeriods_last6: last6.bleedingBetweenPeriods,
    painTrendSlope_last3: last3.painTrendSlope,
    painTrendSlope_last6: last6.painTrendSlope,
    cycleLengthVariabilityDays_last3: last3.cycleLengthVariabilityDays,
    cycleLengthVariabilityDays_last6: last6.cycleLengthVariabilityDays,
  };
}

export interface RedFlagLog {
  painScore?: number | null;
  redFlags?: {
    suddenSeverePain?: boolean;
    fainting?: boolean;
    possiblePregnancySuspected?: boolean;
  } | null;
}

/**
 * Features for the urgent red-flag screen — independent of history, derived
 * from a single just-saved log. Runs client-side right after save,
 * including offline (see apps/web's urgent-care-overlay).
 */
export function extractRedFlagFeatures(
  log: RedFlagLog,
): Record<string, number | boolean> {
  return {
    suddenSeverePain: log.redFlags?.suddenSeverePain ?? false,
    fainting: log.redFlags?.fainting ?? false,
    possiblePregnancySuspected:
      log.redFlags?.possiblePregnancySuspected ?? false,
    painScore: log.painScore ?? 0,
  };
}
