import { describe, expect, it } from "vitest";
import { draftRuleset, rulesetSchema, urgentOnlyRuleset } from "./index";

describe("@mwezicare/rules-engine barrel", () => {
  it("exports a draft ruleset that passes its own schema", () => {
    expect(rulesetSchema.safeParse(draftRuleset).success).toBe(true);
  });

  it("exports an urgent-only subset of the draft ruleset", () => {
    expect(urgentOnlyRuleset.rules.length).toBeGreaterThan(0);
    expect(
      urgentOnlyRuleset.rules.every((rule) => rule.outcome === "urgent"),
    ).toBe(true);
  });
});
