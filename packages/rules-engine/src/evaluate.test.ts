import { describe, expect, it } from "vitest";
import { evaluate, evaluateCondition } from "./evaluate";
import type { Ruleset } from "./dsl";
import { draftRuleset } from "./rulesets/draft-v1";

const ruleset: Ruleset = {
  version: 1,
  status: "draft",
  rules: [
    {
      id: "urgent_rule",
      version: 1,
      priority: 10,
      outcome: "urgent",
      conditions: { feature: "fainting", operator: "eq", value: true },
      reason: { en: "urgent en", sw: "urgent sw" },
      clinicianNote: "note",
    },
    {
      id: "assess_soon_rule",
      version: 1,
      priority: 5,
      outcome: "assess_soon",
      conditions: { feature: "painScore", operator: "gte", value: 7 },
      reason: { en: "assess en", sw: "assess sw" },
      clinicianNote: "note",
    },
    {
      id: "routine_rule",
      version: 1,
      priority: 0,
      outcome: "routine",
      conditions: { all: [] },
      reason: { en: "routine en", sw: "routine sw" },
      clinicianNote: "note",
    },
  ],
};

describe("evaluateCondition", () => {
  it("evaluates a leaf comparison", () => {
    expect(
      evaluateCondition({ feature: "x", operator: "gte", value: 5 }, { x: 7 }),
    ).toBe(true);
    expect(
      evaluateCondition({ feature: "x", operator: "gte", value: 5 }, { x: 3 }),
    ).toBe(false);
  });

  it("evaluates all/any trees", () => {
    const tree = {
      any: [
        { feature: "a", operator: "eq" as const, value: true },
        { all: [{ feature: "b", operator: "eq" as const, value: true }] },
      ],
    };
    expect(evaluateCondition(tree, { a: false, b: true })).toBe(true);
    expect(evaluateCondition(tree, { a: false, b: false })).toBe(false);
  });

  it("treats a missing feature key as false rather than throwing", () => {
    expect(() =>
      evaluateCondition(
        { feature: "missing", operator: "eq", value: true },
        {},
      ),
    ).not.toThrow();
    expect(
      evaluateCondition(
        { feature: "missing", operator: "eq", value: true },
        {},
      ),
    ).toBe(false);
  });

  it("`all: []` is vacuously true and `any: []` is vacuously false", () => {
    expect(evaluateCondition({ all: [] }, {})).toBe(true);
    expect(evaluateCondition({ any: [] }, {})).toBe(false);
  });

  it("numeric operators are false (not thrown) against non-numeric values", () => {
    expect(
      evaluateCondition(
        { feature: "x", operator: "gte", value: 5 },
        { x: "seven" },
      ),
    ).toBe(false);
  });

  it("evaluates neq, lt and lte", () => {
    expect(
      evaluateCondition({ feature: "x", operator: "neq", value: 5 }, { x: 7 }),
    ).toBe(true);
    expect(
      evaluateCondition({ feature: "x", operator: "neq", value: 5 }, { x: 5 }),
    ).toBe(false);
    expect(
      evaluateCondition({ feature: "x", operator: "lt", value: 5 }, { x: 3 }),
    ).toBe(true);
    expect(
      evaluateCondition({ feature: "x", operator: "lt", value: 5 }, { x: 5 }),
    ).toBe(false);
    expect(
      evaluateCondition({ feature: "x", operator: "lte", value: 5 }, { x: 5 }),
    ).toBe(true);
    expect(
      evaluateCondition({ feature: "x", operator: "lte", value: 5 }, { x: 6 }),
    ).toBe(false);
  });

  it("evaluates in (feature value is a member of the rule's value array)", () => {
    expect(
      evaluateCondition(
        { feature: "x", operator: "in", value: ["a", "b"] },
        { x: "a" },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { feature: "x", operator: "in", value: ["a", "b"] },
        { x: "c" },
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { feature: "x", operator: "in", value: "not-an-array" },
        { x: "a" },
      ),
    ).toBe(false);
  });

  it("evaluates includes (feature value is an array containing the rule's value)", () => {
    expect(
      evaluateCondition(
        { feature: "x", operator: "includes", value: "a" },
        { x: ["a", "b"] },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { feature: "x", operator: "includes", value: "c" },
        { x: ["a", "b"] },
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { feature: "x", operator: "includes", value: "a" },
        { x: "not-an-array" },
      ),
    ).toBe(false);
  });
});

describe("evaluate", () => {
  it("returns the highest-severity fired outcome: urgent beats assess_soon beats routine", () => {
    const result = evaluate(ruleset, { fainting: true, painScore: 8 });
    expect(result.outcome).toBe("urgent");
    expect(result.firedRules.map((r) => r.id)).toEqual(["urgent_rule"]);
  });

  it("falls through to assess_soon when no urgent rule fires", () => {
    const result = evaluate(ruleset, { fainting: false, painScore: 8 });
    expect(result.outcome).toBe("assess_soon");
  });

  it("falls through to the routine baseline when nothing else fires", () => {
    const result = evaluate(ruleset, { fainting: false, painScore: 2 });
    expect(result.outcome).toBe("routine");
    expect(result.firedRules.map((r) => r.id)).toEqual(["routine_rule"]);
  });

  it("is deterministic for the same inputs", () => {
    const features = { fainting: true, painScore: 8 };
    const first = evaluate(ruleset, features);
    const second = evaluate(ruleset, features);
    expect(first).toEqual(second);
  });

  it("only returns reasons for the winning severity tier, not lower tiers that also fired", () => {
    const result = evaluate(ruleset, { fainting: true, painScore: 9 });
    expect(result.reasons).toEqual([{ en: "urgent en", sw: "urgent sw" }]);
  });

  it("an empty fired set (ruleset with no matching rules) returns routine with no reasons", () => {
    const empty: Ruleset = { version: 1, status: "draft", rules: [] };
    const result = evaluate(empty, {});
    expect(result).toEqual({ outcome: "routine", firedRules: [], reasons: [] });
  });

  it("the real draft ruleset always resolves to routine on an empty/benign feature set", () => {
    const result = evaluate(draftRuleset, {});
    expect(result.outcome).toBe("routine");
  });

  it("the real draft ruleset flags assess_soon for noticeably variable cycle timing alone", () => {
    const result = evaluate(draftRuleset, {
      cycleLengthVariabilityDays_last6: 9,
    });
    expect(result.outcome).toBe("assess_soon");
    expect(result.firedRules.map((r) => r.id)).toEqual([
      "assess_soon_irregular_cycle_timing",
    ]);
  });

  it("the real draft ruleset does not flag cycle timing below the variability threshold", () => {
    const result = evaluate(draftRuleset, {
      cycleLengthVariabilityDays_last6: 8,
    });
    expect(result.outcome).toBe("routine");
  });

  it("the real draft ruleset does not flag family history alone, with no pain history", () => {
    const result = evaluate(draftRuleset, {
      familyHistoryEndometriosis: true,
    });
    expect(result.outcome).toBe("routine");
  });

  it("the real draft ruleset does not flag severe-pain history alone, with no family history", () => {
    const result = evaluate(draftRuleset, {
      cyclesWithMaxPainGte7_last3: 2,
    });
    expect(result.outcome).toBe("routine");
  });

  it("the real draft ruleset flags assess_soon for family history combined with a severe-pain cycle", () => {
    const result = evaluate(draftRuleset, {
      familyHistoryEndometriosis: true,
      cyclesWithMaxPainGte7_last3: 1,
    });
    expect(result.outcome).toBe("assess_soon");
    expect(result.firedRules.map((r) => r.id)).toEqual([
      "assess_soon_family_history_with_pain",
    ]);
  });

  it("the real draft ruleset flags assess_soon for blood in urine via the shared bowel/urinary feature", () => {
    const result = evaluate(draftRuleset, {
      anyBowelOrUrinarySymptom_last3: true,
    });
    expect(result.outcome).toBe("assess_soon");
    expect(result.firedRules.map((r) => r.id)).toEqual([
      "assess_soon_pain_with_bowel_or_urination",
    ]);
  });
});
