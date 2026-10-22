import { describe, expect, it } from "vitest";
import { deriveCycles } from "./cycles";
import { buildSummaryData, type SummaryLog } from "./summary";

function log(partial: Partial<SummaryLog> & { logDate: string }): SummaryLog {
  return {
    periodDay: false,
    painScore: 0,
    symptoms: {},
    impact: {},
    ...partial,
  };
}

describe("buildSummaryData", () => {
  it("aggregates cycles, pain chart, symptom frequency and missed days within range", () => {
    const logs: SummaryLog[] = [
      log({
        logDate: "2026-01-01",
        periodDay: true,
        painScore: 6,
        symptoms: { fatigue: true },
        impact: { missedSchool: true },
      }),
      log({
        logDate: "2026-01-02",
        periodDay: true,
        painScore: 4,
        symptoms: { fatigue: true, nausea: true },
      }),
      log({
        logDate: "2026-01-29",
        periodDay: true,
        painScore: 3,
        impact: { missedWork: true },
      }),
    ];
    const cycles = deriveCycles(logs);

    const data = buildSummaryData(logs, cycles, null, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(data.cycles).toHaveLength(2);
    expect(data.cycles[0]).toEqual({
      startDate: "2026-01-01",
      periodLengthDays: 2,
      cycleLengthDays: 28,
    });
    expect(data.painChart.length).toBeGreaterThan(0);
    expect(data.symptomFrequency).toEqual([
      { symptom: "fatigue", days: 2 },
      { symptom: "nausea", days: 1 },
      { symptom: "painWithBowelMovements", days: 0 },
      { symptom: "painWithUrination", days: 0 },
      { symptom: "painWithSex", days: 0 },
    ]);
    expect(data.missedSchoolDays).toBe(1);
    expect(data.missedWorkDays).toBe(1);
  });

  it("excludes logs and cycles outside the requested range", () => {
    const logs: SummaryLog[] = [
      log({
        logDate: "2025-06-01",
        periodDay: true,
        symptoms: { fatigue: true },
      }),
      log({ logDate: "2026-01-01", periodDay: true }),
    ];
    const cycles = deriveCycles(logs);

    const data = buildSummaryData(logs, cycles, null, {
      from: "2026-01-01",
      to: "2026-01-31",
    });

    expect(data.cycles).toHaveLength(1);
    expect(data.cycles[0]?.startDate).toBe("2026-01-01");
    expect(
      data.symptomFrequency.find((s) => s.symptom === "fatigue")?.days,
    ).toBe(0);
  });

  it("passes the assessment through unchanged", () => {
    const assessment = {
      outcome: "assess_soon" as const,
      reasons: [{ en: "en reason", sw: "sw reason" }],
      rulesetVersion: 1,
    };
    const data = buildSummaryData([], [], assessment, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(data.assessment).toEqual(assessment);
  });

  it("handles no logs/cycles at all", () => {
    const data = buildSummaryData([], [], null, {
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(data.cycles).toEqual([]);
    expect(data.painChart).toEqual([]);
    expect(data.missedSchoolDays).toBe(0);
    expect(data.assessment).toBeNull();
  });
});
