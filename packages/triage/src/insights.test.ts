import { describe, expect, it } from "vitest";
import { deriveCycles } from "./cycles";
import type { TriageLog } from "./features";
import { summarizeCyclesForCharts } from "./insights";

function log(partial: Partial<TriageLog> & { logDate: string }): TriageLog {
  return {
    periodDay: false,
    bleedingLevel: "none",
    painScore: 0,
    symptoms: {},
    impact: {},
    ...partial,
  };
}

describe("summarizeCyclesForCharts", () => {
  it("returns an empty array when there are no logs", () => {
    expect(summarizeCyclesForCharts([], [])).toEqual([]);
  });

  it("computes max/avg pain and impact-day counts per cycle, last 6 cycles", () => {
    const logs: TriageLog[] = [
      log({
        logDate: "2026-01-01",
        periodDay: true,
        painScore: 4,
        impact: { missedSchool: true },
      }),
      log({ logDate: "2026-01-02", periodDay: true, painScore: 8 }),
      log({ logDate: "2026-01-29", periodDay: true, painScore: 2 }),
    ];
    const cycles = deriveCycles(logs);
    const chart = summarizeCyclesForCharts(logs, cycles);
    expect(chart).toHaveLength(2);
    expect(chart[0]).toEqual({
      cycleStartDate: "2026-01-01",
      maxPainScore: 8,
      avgPainScore: 6,
      impactDays: 1,
    });
  });

  it("only returns the last 6 cycles even if more history exists", () => {
    // 8 period starts, 28 days apart.
    const spaced: TriageLog[] = Array.from({ length: 8 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 0, 1 + i * 28))
        .toISOString()
        .slice(0, 10);
      return log({ logDate: date, periodDay: true, painScore: i });
    });
    const cycles = deriveCycles(spaced);
    expect(cycles.length).toBe(8);
    const chart = summarizeCyclesForCharts(spaced, cycles);
    expect(chart).toHaveLength(6);
  });
});
