/** Adds (or subtracts, for a negative count) whole days to a YYYY-MM-DD date string. */
export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
