import { describe, expect, it } from "vitest";
import { deriveCycles, estimateNextPeriod, type PeriodDayLog } from "./cycles";

function periodDays(dates: string[]): PeriodDayLog[] {
  return dates.map((logDate) => ({ logDate, periodDay: true }));
}

describe("deriveCycles", () => {
  it("returns an empty array when no period days have been logged", () => {
    expect(deriveCycles([{ logDate: "2026-01-01", periodDay: false }])).toEqual(
      [],
    );
    expect(deriveCycles([])).toEqual([]);
  });

  it("a single logged period produces one cycle with an unknown (null) cycle length", () => {
    const cycles = deriveCycles(
      periodDays(["2026-01-01", "2026-01-02", "2026-01-03"]),
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      periodLengthDays: 3,
      cycleLengthDays: null,
    });
  });

  it("two regular 28-day cycles compute the cycle length between period starts", () => {
    const cycles = deriveCycles(
      periodDays([
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
        "2026-01-29",
        "2026-01-30",
      ]),
    );
    expect(cycles).toHaveLength(2);
    expect(cycles[0]).toMatchObject({
      startDate: "2026-01-01",
      endDate: "2026-01-03",
      cycleLengthDays: 28,
    });
    expect(cycles[1]).toMatchObject({
      startDate: "2026-01-29",
      cycleLengthDays: null,
    });
  });

  it("irregular cycle lengths are reported faithfully, not smoothed", () => {
    // Periods starting Jan 1, Jan 25 (24-day cycle), Mar 1 (35-day cycle).
    const cycles = deriveCycles(
      periodDays(["2026-01-01", "2026-01-25", "2026-03-01"]),
    );
    expect(cycles.map((c) => c.cycleLengthDays)).toEqual([24, 35, null]);
  });

  it("tolerates a single missing/un-logged day inside a period (still one period instance)", () => {
    // Jan 2 wasn't logged at all, but Jan 1 and Jan 3 were — still one period.
    const cycles = deriveCycles(
      periodDays(["2026-01-01", "2026-01-03", "2026-01-04"]),
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toMatchObject({
      startDate: "2026-01-01",
      endDate: "2026-01-04",
    });
  });

  it("a gap of more than 2 days starts a new period instance instead of bridging it", () => {
    const cycles = deriveCycles(periodDays(["2026-01-01", "2026-01-10"]));
    expect(cycles).toHaveLength(2);
  });

  it("deduplicates repeated log entries for the same date", () => {
    const cycles = deriveCycles(
      periodDays(["2026-01-01", "2026-01-01", "2026-01-02"]),
    );
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.periodLengthDays).toBe(2);
  });
});

describe("estimateNextPeriod", () => {
  it("returns null when there's only a single period logged (no completed cycle yet)", () => {
    const cycles = deriveCycles(periodDays(["2026-01-01", "2026-01-02"]));
    expect(estimateNextPeriod(cycles)).toBeNull();
  });

  it("returns null for an empty cycle list", () => {
    expect(estimateNextPeriod([])).toBeNull();
  });

  it("projects the next period from the average of up to the last 3 completed cycles", () => {
    const cycles = deriveCycles(
      periodDays(["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-28"]),
    );
    // cycle lengths: 28, 28, 30 -> avg ~28.67 -> rounds to 29
    const estimate = estimateNextPeriod(cycles);
    expect(estimate?.isEstimate).toBe(true);
    expect(estimate?.date).toBe("2026-04-26");
  });

  it("only averages the last 3 completed cycles, not every historical one", () => {
    const cycles = deriveCycles(
      periodDays([
        "2025-01-01", // cycle 0 -> cycle 1: huge 60-day outlier, should be dropped
        "2025-03-02",
        "2025-04-01", // 30
        "2025-05-01", // 30
        "2025-05-31", // 30
      ]),
    );
    const estimate = estimateNextPeriod(cycles);
    expect(estimate?.date).toBe("2025-06-30");
  });
});
