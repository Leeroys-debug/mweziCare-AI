import { describe, expect, it } from "vitest";
import { conditionSchema, ruleSchema, rulesetSchema } from "./dsl";

function validRule() {
  return {
    id: "test_rule",
    version: 1,
    priority: 10,
    outcome: "assess_soon" as const,
    conditions: { feature: "painScore", operator: "gte" as const, value: 7 },
    reason: { en: "english reason", sw: "sababu ya kiswahili" },
    clinicianNote: "note",
  };
}

describe("conditionSchema", () => {
  it("accepts a leaf condition", () => {
    expect(
      conditionSchema.safeParse({
        feature: "painScore",
        operator: "gte",
        value: 7,
      }).success,
    ).toBe(true);
  });

  it("accepts nested all/any trees", () => {
    const tree = {
      any: [
        { feature: "fainting", operator: "eq", value: true },
        {
          all: [
            { feature: "painScore", operator: "gte", value: 7 },
            {
              feature: "possiblePregnancySuspected",
              operator: "eq",
              value: true,
            },
          ],
        },
      ],
    };
    expect(conditionSchema.safeParse(tree).success).toBe(true);
  });

  it("accepts the vacuous all-of-nothing baseline condition", () => {
    expect(conditionSchema.safeParse({ all: [] }).success).toBe(true);
  });

  it("rejects an invalid operator", () => {
    const result = conditionSchema.safeParse({
      feature: "painScore",
      operator: "greater-than",
      value: 7,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a leaf missing a feature name", () => {
    expect(
      conditionSchema.safeParse({ operator: "eq", value: 7 }).success,
    ).toBe(false);
  });
});

describe("ruleSchema", () => {
  it("accepts a well-formed rule", () => {
    expect(ruleSchema.safeParse(validRule()).success).toBe(true);
  });

  it("rejects a rule missing an sw reason (invalid ruleset can never be saved)", () => {
    const rule = validRule();
    const result = ruleSchema.safeParse({
      ...rule,
      reason: { en: rule.reason.en, sw: "" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid outcome", () => {
    const result = ruleSchema.safeParse({
      ...validRule(),
      outcome: "critical",
    });
    expect(result.success).toBe(false);
  });
});

describe("rulesetSchema", () => {
  it("rejects an empty ruleset (must have at least one rule)", () => {
    expect(
      rulesetSchema.safeParse({ version: 1, status: "draft", rules: [] })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = rulesetSchema.safeParse({
      version: 1,
      status: "published",
      rules: [validRule()],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed ruleset", () => {
    expect(
      rulesetSchema.safeParse({
        version: 1,
        status: "draft",
        rules: [validRule()],
      }).success,
    ).toBe(true);
  });
});
