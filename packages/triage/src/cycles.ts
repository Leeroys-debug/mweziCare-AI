export interface PeriodDayLog {
  logDate: string; // YYYY-MM-DD
  periodDay: boolean;
}

export interface Cycle {
  /** First day of this period instance. */
  startDate: string;
  /** Last day of this period instance (the bleeding itself, not the full cycle). */
  endDate: string;
  periodLengthDays: number;
  /** Days until the next period started. `null` for the most recent/ongoing cycle — not enough data yet. */
  cycleLengthDays: number | null;
}

export interface NextPeriodEstimate {
  date: string;
  isEstimate: true;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getTime();
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return toIsoDate(parseDate(iso) + days * MS_PER_DAY);
}

function diffDays(a: string, b: string): number {
  return Math.round((parseDate(b) - parseDate(a)) / MS_PER_DAY);
}

/**
 * Groups period-day logs into period instances, then derives cycle lengths
 * between consecutive period starts. Tolerates a single missing/un-logged
 * day inside a period (a gap of up to 2 calendar days between consecutive
 * period-day entries is still treated as the same period) — logging gaps
 * are expected, not an error condition.
 */
export function deriveCycles(logs: PeriodDayLog[]): Cycle[] {
  const periodDates = [
    ...new Set(logs.filter((l) => l.periodDay).map((l) => l.logDate)),
  ].sort();

  if (periodDates.length === 0) return [];

  const groups: string[][] = [];
  let current: string[] = [periodDates[0]!];
  for (let i = 1; i < periodDates.length; i++) {
    const date = periodDates[i]!;
    const prev = current[current.length - 1]!;
    if (diffDays(prev, date) <= 2) {
      current.push(date);
    } else {
      groups.push(current);
      current = [date];
    }
  }
  groups.push(current);

  return groups.map((group, i) => {
    const startDate = group[0]!;
    const endDate = group[group.length - 1]!;
    const next = groups[i + 1];
    return {
      startDate,
      endDate,
      periodLengthDays: diffDays(startDate, endDate) + 1,
      cycleLengthDays: next ? diffDays(startDate, next[0]!) : null,
    };
  });
}

/** Average of up to the last 3 *completed* cycle lengths, projected from the most recent period start. */
export function estimateNextPeriod(cycles: Cycle[]): NextPeriodEstimate | null {
  const completed = cycles.filter((c) => c.cycleLengthDays !== null);
  if (completed.length === 0 || cycles.length === 0) return null;

  const recent = completed.slice(-3);
  const avgLength =
    recent.reduce((sum, c) => sum + c.cycleLengthDays!, 0) / recent.length;
  const mostRecentStart = cycles[cycles.length - 1]!.startDate;

  return {
    date: addDays(mostRecentStart, Math.round(avgLength)),
    isEstimate: true,
  };
}

/** Inclusive [startDate, endDate] date range a given cycle index spans, bounded by `until` for the most recent/ongoing cycle. */
export function cycleDateRange(
  cycles: Cycle[],
  index: number,
  until: string,
): { from: string; to: string } {
  const cycle = cycles[index];
  if (!cycle) throw new Error(`No cycle at index ${index}`);
  const next = cycles[index + 1];
  return {
    from: cycle.startDate,
    to: next ? addDays(next.startDate, -1) : until,
  };
}

export function logsInRange<T extends { logDate: string }>(
  logs: T[],
  range: { from: string; to: string },
): T[] {
  return logs.filter(
    (log) => log.logDate >= range.from && log.logDate <= range.to,
  );
}
