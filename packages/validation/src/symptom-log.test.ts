import { describe, expect, it } from "vitest";
import {
  logsBatchSchema,
  symptomLogSchema,
  type SymptomLogInput,
} from "./symptom-log";

function validLog(): SymptomLogInput {
  return {
    clientId: "5f1c5e3a-0000-4000-8000-000000000001",
    logDate: "2026-01-01",
    periodDay: true,
    bleedingLevel: "medium" as const,
    painScore: 5,
    painLocations: ["lower_abdomen" as const],
    painTiming: [],
    symptoms: {
      fatigue: true,
      nausea: false,
      painWithBowelMovements: false,
      painWithUrination: false,
      bloodInUrine: false,
    },
    impact: {
      missedSchool: false,
      missedWork: false,
      sleepDisrupted: true,
      activitiesLimited: false,
    },
    redFlags: {
      suddenSeverePain: false,
      fainting: false,
      possiblePregnancySuspected: false,
    },
    notes: "felt better after resting",
    updatedAt: "2026-01-01T08:00:00.000Z",
  };
}

describe("symptomLogSchema", () => {
  it("accepts a well-formed log", () => {
    expect(symptomLogSchema.safeParse(validLog()).success).toBe(true);
  });

  it("rejects a pain score above 10", () => {
    const result = symptomLogSchema.safeParse({ ...validLog(), painScore: 11 });
    expect(result.success).toBe(false);
  });

  it("rejects a pain score below 0", () => {
    const result = symptomLogSchema.safeParse({ ...validLog(), painScore: -1 });
    expect(result.success).toBe(false);
  });

  it("allows a null pain score (not yet logged)", () => {
    expect(
      symptomLogSchema.safeParse({ ...validLog(), painScore: null }).success,
    ).toBe(true);
  });

  it("rejects an invalid bleeding level", () => {
    const result = symptomLogSchema.safeParse({
      ...validLog(),
      bleedingLevel: "moderate",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the optional painWithSex flag", () => {
    const log = validLog();
    log.symptoms = { ...log.symptoms, painWithSex: true };
    expect(symptomLogSchema.safeParse(log).success).toBe(true);
  });

  it("accepts a true bloodInUrine flag", () => {
    const log = validLog();
    log.symptoms = { ...log.symptoms, bloodInUrine: true };
    expect(symptomLogSchema.safeParse(log).success).toBe(true);
  });

  it("rejects a log missing the required bloodInUrine flag", () => {
    const log = validLog();
    const { bloodInUrine: _omitted, ...symptomsWithoutBloodInUrine } =
      log.symptoms;
    const result = symptomLogSchema.safeParse({
      ...log,
      symptoms: symptomsWithoutBloodInUrine,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed logDate", () => {
    const result = symptomLogSchema.safeParse({
      ...validLog(),
      logDate: "01/01/2026",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown pain location", () => {
    const result = symptomLogSchema.safeParse({
      ...validLog(),
      painLocations: ["head"],
    });
    expect(result.success).toBe(false);
  });

  it("defaults painTiming to an empty array when omitted", () => {
    const { painTiming: _omitted, ...logWithoutTiming } = validLog();
    const result = symptomLogSchema.safeParse(logWithoutTiming);
    expect(result.success && result.data.painTiming).toEqual([]);
  });

  it("accepts a well-formed painTiming value", () => {
    const result = symptomLogSchema.safeParse({
      ...validLog(),
      painTiming: ["before_period", "between_periods"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown painTiming value", () => {
    const result = symptomLogSchema.safeParse({
      ...validLog(),
      painTiming: ["mid_cycle"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts painPersistsDespiteRelief as true, false, null or omitted", () => {
    for (const value of [true, false, null, undefined]) {
      const result = symptomLogSchema.safeParse({
        ...validLog(),
        painPersistsDespiteRelief: value,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("logsBatchSchema", () => {
  it("accepts a batch of 1-100 logs", () => {
    expect(logsBatchSchema.safeParse({ logs: [validLog()] }).success).toBe(
      true,
    );
  });

  it("rejects an empty batch", () => {
    expect(logsBatchSchema.safeParse({ logs: [] }).success).toBe(false);
  });

  it("rejects a batch over 100 logs", () => {
    const logs = Array.from({ length: 101 }, (_, i) => ({
      ...validLog(),
      clientId: `5f1c5e3a-0000-4000-8000-${String(i).padStart(12, "0")}`,
    }));
    expect(logsBatchSchema.safeParse({ logs }).success).toBe(false);
  });
});
