import { logsInRange, type Cycle } from "./cycles";
import { summarizeCyclesForCharts, type CycleChartPoint } from "./insights";
import type { TriageOutcome } from "@mwezicare/rules-engine";

export interface SummaryLog {
  logDate: string;
  periodDay: boolean;
  bleedingLevel?: string | null;
  painScore?: number | null;
  symptoms?: {
    fatigue?: boolean;
    nausea?: boolean;
    painWithBowelMovements?: boolean;
    painWithUrination?: boolean;
    bloodInUrine?: boolean;
    painWithSex?: boolean;
  } | null;
  impact?: {
    missedSchool?: boolean;
    missedWork?: boolean;
  } | null;
}

export interface SummaryAssessment {
  outcome: TriageOutcome;
  reasons: { en: string; sw: string }[];
  rulesetVersion: number;
}

export interface SummaryCycle {
  startDate: string;
  periodLengthDays: number;
  cycleLengthDays: number | null;
}

export interface SymptomFrequency {
  symptom: string;
  days: number;
}

export interface SummaryData {
  from: string;
  to: string;
  cycles: SummaryCycle[];
  painChart: CycleChartPoint[];
  symptomFrequency: SymptomFrequency[];
  missedSchoolDays: number;
  missedWorkDays: number;
  assessment: SummaryAssessment | null;
}

const SYMPTOM_KEYS = [
  "fatigue",
  "nausea",
  "painWithBowelMovements",
  "painWithUrination",
  "bloodInUrine",
  "painWithSex",
] as const;

/**
 * Aggregates a user's logs/cycles into the clinician-summary shape — reused
 * by both the PDF renderer (apps/web/lib/summary-pdf.tsx) and the web
 * preview, so the two never drift. `allLogs`/`allCycles` should be the
 * user's full history (cycle-length math needs the cycle before/after a
 * range boundary); this function does the range filtering internally.
 */
export function buildSummaryData(
  allLogs: SummaryLog[],
  allCycles: Cycle[],
  assessment: SummaryAssessment | null,
  range: { from: string; to: string },
): SummaryData {
  const logsInWindow = logsInRange(allLogs, range);
  const cyclesInWindow = allCycles.filter(
    (c) => c.startDate >= range.from && c.startDate <= range.to,
  );

  const symptomFrequency: SymptomFrequency[] = SYMPTOM_KEYS.map((symptom) => ({
    symptom,
    days: logsInWindow.filter((log) => log.symptoms?.[symptom]).length,
  }));

  const missedSchoolDays = logsInWindow.filter(
    (log) => log.impact?.missedSchool,
  ).length;
  const missedWorkDays = logsInWindow.filter(
    (log) => log.impact?.missedWork,
  ).length;

  return {
    from: range.from,
    to: range.to,
    cycles: cyclesInWindow.map((c) => ({
      startDate: c.startDate,
      periodLengthDays: c.periodLengthDays,
      cycleLengthDays: c.cycleLengthDays,
    })),
    painChart: summarizeCyclesForCharts(logsInWindow, cyclesInWindow),
    symptomFrequency,
    missedSchoolDays,
    missedWorkDays,
    assessment,
  };
}
