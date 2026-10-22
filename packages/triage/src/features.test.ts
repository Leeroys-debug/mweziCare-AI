import { describe, expect, it } from "vitest";
import { deriveCycles } from "./cycles";
import {
  extractFeatures,
  extractRedFlagFeatures,
  type TriageLog,
} from "./features";

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

describe("extractFeatures", () => {
  it("returns all-zero/false features when there's no cycle data yet", () => {
    const features = extractFeatures([log({ logDate: "2026-01-01" })], []);
    expect(features.cyclesWithMaxPainGte7_last3).toBe(0);
    expect(features.anyPainWithBowelOrUrination_last3).toBe(false);
    expect(features.painTrendSlope_last3).toBe(0);
  });

  it("counts cycles with a max pain score >= 7 within the window", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true, painScore: 8 }),
      log({ logDate: "2026-01-02", periodDay: true, painScore: 2 }),
      log({ logDate: "2026-01-29", periodDay: true, painScore: 3 }),
    ];
    const cycles = deriveCycles(logs);
    const features = extractFeatures(logs, cycles);
    expect(features.cyclesWithMaxPainGte7_last3).toBe(1);
  });

  it("counts missed school/work/sleep/activity days from the impact flags", () => {
    const logs: TriageLog[] = [
      log({
        logDate: "2026-01-01",
        periodDay: true,
        impact: { missedSchool: true },
      }),
      log({
        logDate: "2026-01-02",
        periodDay: true,
        impact: { sleepDisrupted: true },
      }),
      log({ logDate: "2026-01-03", periodDay: true, impact: {} }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.missedSchoolOrWorkOrSleepOrActivityDays_last3).toBe(2);
  });

  it("counts pain on non-period days as pain outside menstruation", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true, painScore: 4 }),
      log({ logDate: "2026-01-10", periodDay: false, painScore: 5 }),
      log({ logDate: "2026-01-29", periodDay: true, painScore: 3 }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.painDaysOutsideMenstruation_last3).toBe(1);
  });

  it("flags any pain with bowel movements or urination within the window", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true }),
      log({
        logDate: "2026-01-02",
        periodDay: true,
        symptoms: { painWithUrination: true },
      }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.anyPainWithBowelOrUrination_last3).toBe(true);
  });

  it("counts heavy/very-heavy bleeding days", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true, bleedingLevel: "heavy" }),
      log({
        logDate: "2026-01-02",
        periodDay: true,
        bleedingLevel: "very_heavy",
      }),
      log({ logDate: "2026-01-03", periodDay: true, bleedingLevel: "light" }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.heavyOrVeryHeavyBleedingDays_last3).toBe(2);
  });

  it("counts periods longer than 7 days", () => {
    const logs: TriageLog[] = Array.from({ length: 9 }, (_, i) =>
      log({
        logDate: `2026-01-${String(i + 1).padStart(2, "0")}`,
        periodDay: true,
      }),
    );
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.periodsLongerThan7Days_last3).toBe(1);
  });

  it("flags bleeding between periods", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true, bleedingLevel: "light" }),
      log({
        logDate: "2026-01-10",
        periodDay: false,
        bleedingLevel: "spotting",
      }),
      log({ logDate: "2026-01-29", periodDay: true, bleedingLevel: "light" }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.bleedingBetweenPeriods_last3).toBe(true);
  });

  it("computes a positive pain trend slope when pain is worsening over time", () => {
    const logs: TriageLog[] = [
      log({ logDate: "2026-01-01", periodDay: true, painScore: 2 }),
      log({ logDate: "2026-01-02", periodDay: true, painScore: 4 }),
      log({ logDate: "2026-01-03", periodDay: true, painScore: 6 }),
      log({ logDate: "2026-01-29", periodDay: true, painScore: 3 }),
    ];
    const features = extractFeatures(logs, deriveCycles(logs));
    expect(features.painTrendSlope_last3 as number).toBeGreaterThan(0);
  });

  it("produces both _last3 and _last6 variants", () => {
    const features = extractFeatures([], []);
    expect(features).toHaveProperty("cyclesWithMaxPainGte7_last3");
    expect(features).toHaveProperty("cyclesWithMaxPainGte7_last6");
  });
});

describe("extractRedFlagFeatures", () => {
  it("reads red flags and pain score off a single log, defaulting missing fields to false/0", () => {
    expect(extractRedFlagFeatures({})).toEqual({
      suddenSeverePain: false,
      fainting: false,
      possiblePregnancySuspected: false,
      painScore: 0,
    });
  });

  it("passes through true red flags and the pain score", () => {
    expect(
      extractRedFlagFeatures({
        painScore: 9,
        redFlags: {
          suddenSeverePain: true,
          fainting: false,
          possiblePregnancySuspected: true,
        },
      }),
    ).toEqual({
      suddenSeverePain: true,
      fainting: false,
      possiblePregnancySuspected: true,
      painScore: 9,
    });
  });
});
