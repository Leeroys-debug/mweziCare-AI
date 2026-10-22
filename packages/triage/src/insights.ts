import { cycleDateRange, logsInRange, type Cycle } from "./cycles";
import type { TriageLog } from "./features";

export interface CycleChartPoint {
  cycleStartDate: string;
  maxPainScore: number;
  avgPainScore: number;
  impactDays: number;
}

/** Per-cycle chart data for the Insights page, last 6 cycles. Kept in packages/triage so the route/page stay thin (CLAUDE.md). */
export function summarizeCyclesForCharts(
  logs: TriageLog[],
  cycles: Cycle[],
): CycleChartPoint[] {
  const sortedLogs = [...logs].sort((a, b) => (a.logDate < b.logDate ? -1 : 1));
  const windowEnd = sortedLogs.at(-1)?.logDate;
  if (!windowEnd) return [];

  const last6 = cycles.slice(-6);

  return last6.map((cycle) => {
    const index = cycles.indexOf(cycle);
    const range = cycleDateRange(cycles, index, windowEnd);
    const logsInCycle = logsInRange(sortedLogs, range);

    const painScores = logsInCycle
      .map((log) => log.painScore)
      .filter((score): score is number => score != null);

    const impactDays = logsInCycle.filter(
      (log) =>
        log.impact?.missedSchool ||
        log.impact?.missedWork ||
        log.impact?.sleepDisrupted ||
        log.impact?.activitiesLimited,
    ).length;

    return {
      cycleStartDate: cycle.startDate,
      maxPainScore: painScores.length > 0 ? Math.max(...painScores) : 0,
      avgPainScore:
        painScores.length > 0
          ? Math.round(
              (painScores.reduce((s, v) => s + v, 0) / painScores.length) * 10,
            ) / 10
          : 0,
      impactDays,
    };
  });
}
