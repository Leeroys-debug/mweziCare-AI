export type DashboardRow = Record<string, unknown>;

export interface WeeklyPoint {
  week: string;
  value: number;
}

export interface GroupedPoint {
  group: string;
  value: number;
}

function weekOf(row: DashboardRow): string {
  return String(row.week ?? "");
}

export function latestWeek(rows: DashboardRow[]): string | null {
  const weeks = rows.map(weekOf).filter(Boolean);
  if (weeks.length === 0) return null;
  return [...weeks].sort().at(-1)!;
}

/** Sums `valueKey` across all rows sharing a week — a line-chart series. */
export function sumByWeek(
  rows: DashboardRow[],
  valueKey: string,
): WeeklyPoint[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const week = weekOf(row);
    if (!week) continue;
    totals.set(week, (totals.get(week) ?? 0) + Number(row[valueKey] ?? 0));
  }
  return [...totals.entries()]
    .map(([week, value]) => ({ week, value }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** `valueKey` summed per `groupKey`, restricted to the most recent week — a bar-chart snapshot. */
export function groupedForLatestWeek(
  rows: DashboardRow[],
  groupKey: string,
  valueKey: string,
): GroupedPoint[] {
  const week = latestWeek(rows);
  if (!week) return [];
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (weekOf(row) !== week) continue;
    const group = String(row[groupKey] ?? "unknown");
    totals.set(group, (totals.get(group) ?? 0) + Number(row[valueKey] ?? 0));
  }
  return [...totals.entries()].map(([group, value]) => ({ group, value }));
}

/** `valueKey` summed across every row in the most recent week. */
export function totalForLatestWeek(
  rows: DashboardRow[],
  valueKey: string,
): number {
  const week = latestWeek(rows);
  if (!week) return 0;
  return rows
    .filter((row) => weekOf(row) === week)
    .reduce((sum, row) => sum + Number(row[valueKey] ?? 0), 0);
}

/** Row-count-weighted average of `valueKey` across the most recent week's rows. */
export function averageForLatestWeek(
  rows: DashboardRow[],
  valueKey: string,
): number {
  const week = latestWeek(rows);
  if (!week) return 0;
  const matching = rows.filter((row) => weekOf(row) === week);
  if (matching.length === 0) return 0;
  const sum = matching.reduce((s, row) => s + Number(row[valueKey] ?? 0), 0);
  return sum / matching.length;
}
