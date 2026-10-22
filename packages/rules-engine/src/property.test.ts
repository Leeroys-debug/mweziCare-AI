import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { OUTCOME_SEVERITY } from "./dsl";
import { evaluate, type FeatureRecord } from "./evaluate";
import { draftRuleset } from "./rulesets/draft-v1";

const booleanFeatureKeys = [
  "suddenSeverePain",
  "fainting",
  "possiblePregnancySuspected",
  "anyPainWithBowelOrUrination_last3",
  "bleedingBetweenPeriods_last3",
] as const;

const numericFeatureKeys = [
  "painScore",
  "missedSchoolOrWorkOrSleepOrActivityDays_last3",
  "painTrendSlope_last3",
  "painDaysOutsideMenstruation_last3",
  "heavyOrVeryHeavyBleedingDays_last3",
  "periodsLongerThan7Days_last6",
] as const;

const featureRecordArbitrary = fc.record({
  suddenSeverePain: fc.boolean(),
  fainting: fc.boolean(),
  possiblePregnancySuspected: fc.boolean(),
  anyPainWithBowelOrUrination_last3: fc.boolean(),
  bleedingBetweenPeriods_last3: fc.boolean(),
  painScore: fc.integer({ min: 0, max: 10 }),
  missedSchoolOrWorkOrSleepOrActivityDays_last3: fc.integer({
    min: 0,
    max: 10,
  }),
  painTrendSlope_last3: fc.double({ min: -5, max: 5, noNaN: true }),
  painDaysOutsideMenstruation_last3: fc.integer({ min: 0, max: 10 }),
  heavyOrVeryHeavyBleedingDays_last3: fc.integer({ min: 0, max: 10 }),
  periodsLongerThan7Days_last6: fc.integer({ min: 0, max: 5 }),
});

/** Every condition in the draft ruleset only ever gets *more* true as flags
 * turn on and numbers go up (eq-true / gte / gt / any-of-monotonic /
 * all-of-monotonic) — never a `lt`/`lte` that could stop a higher-severity
 * rule from firing. So augmenting a feature record this way can only raise
 * or hold the outcome, never lower it. */
function augment(base: FeatureRecord): FeatureRecord {
  const augmented: FeatureRecord = { ...base };
  for (const key of booleanFeatureKeys) {
    augmented[key] = true; // only ever turn on, never off
  }
  for (const key of numericFeatureKeys) {
    augmented[key] = (base[key] as number) + 1; // only ever increase
  }
  return augmented;
}

describe("evaluate() monotonicity (property-based)", () => {
  it("augmenting features (more true flags, higher numbers) never lowers the outcome severity", () => {
    fc.assert(
      fc.property(featureRecordArbitrary, (base) => {
        const baseOutcome = evaluate(draftRuleset, base).outcome;
        const augmentedOutcome = evaluate(draftRuleset, augment(base)).outcome;
        expect(OUTCOME_SEVERITY[augmentedOutcome]).toBeGreaterThanOrEqual(
          OUTCOME_SEVERITY[baseOutcome],
        );
      }),
    );
  });

  it("adding an urgent red-flag symptom (fainting) on top of any history always yields urgent", () => {
    fc.assert(
      fc.property(featureRecordArbitrary, (base) => {
        const result = evaluate(draftRuleset, { ...base, fainting: true });
        expect(result.outcome).toBe("urgent");
      }),
    );
  });

  it("adding sudden severe pain on top of any history always yields urgent", () => {
    fc.assert(
      fc.property(featureRecordArbitrary, (base) => {
        const result = evaluate(draftRuleset, {
          ...base,
          suddenSeverePain: true,
        });
        expect(result.outcome).toBe("urgent");
      }),
    );
  });

  it("possible pregnancy plus severe pain (>=7) on top of any history always yields urgent", () => {
    fc.assert(
      fc.property(featureRecordArbitrary, (base) => {
        const result = evaluate(draftRuleset, {
          ...base,
          possiblePregnancySuspected: true,
          painScore: 7,
        });
        expect(result.outcome).toBe("urgent");
      }),
    );
  });
});
