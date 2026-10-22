import {
  draftRuleset,
  evaluate,
  OUTCOME_SEVERITY,
} from "@mwezicare/rules-engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { deriveCycles } from "./cycles";
import {
  extractFeatures,
  extractRedFlagFeatures,
  type TriageLog,
} from "./features";

/** A random-ish but plausible multi-cycle log history. */
const logHistoryArbitrary = fc
  .record({
    cycles: fc.integer({ min: 1, max: 6 }),
    cycleLength: fc.integer({ min: 21, max: 35 }),
    periodLength: fc.integer({ min: 2, max: 9 }),
    basePain: fc.integer({ min: 0, max: 6 }),
  })
  .map(({ cycles, cycleLength, periodLength, basePain }) => {
    const logs: TriageLog[] = [];
    const start = new Date("2026-01-01T00:00:00.000Z").getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let c = 0; c < cycles; c++) {
      for (let d = 0; d < periodLength; d++) {
        const date = new Date(start + (c * cycleLength + d) * dayMs)
          .toISOString()
          .slice(0, 10);
        logs.push({
          logDate: date,
          periodDay: true,
          bleedingLevel: "light",
          painScore: basePain,
          symptoms: { painWithBowelMovements: false, painWithUrination: false },
          impact: {
            missedSchool: false,
            missedWork: false,
            sleepDisrupted: false,
            activitiesLimited: false,
          },
        });
      }
    }
    return logs;
  });

function outcomeFor(
  logs: TriageLog[],
  redFlagOverride?: Record<string, boolean>,
) {
  const cycles = deriveCycles(logs);
  const historyFeatures = extractFeatures(logs, cycles);
  const latest = logs.at(-1) ?? {};
  const redFlagFeatures = {
    ...extractRedFlagFeatures(latest),
    ...(redFlagOverride ?? {}),
  };
  return evaluate(draftRuleset, { ...historyFeatures, ...redFlagFeatures })
    .outcome;
}

describe("triage pipeline monotonicity (property-based)", () => {
  it("adding an urgent red-flag symptom (fainting) to any log history never lowers the outcome", () => {
    fc.assert(
      fc.property(logHistoryArbitrary, (logs) => {
        const baseline = outcomeFor(logs);
        const withFainting = outcomeFor(logs, { fainting: true });
        expect(OUTCOME_SEVERITY[withFainting]).toBeGreaterThanOrEqual(
          OUTCOME_SEVERITY[baseline],
        );
        expect(withFainting).toBe("urgent");
      }),
    );
  });

  it("adding sudden severe pain to any log history always yields urgent", () => {
    fc.assert(
      fc.property(logHistoryArbitrary, (logs) => {
        expect(outcomeFor(logs, { suddenSeverePain: true })).toBe("urgent");
      }),
    );
  });
});
