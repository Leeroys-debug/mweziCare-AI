import {
  OUTCOME_SEVERITY,
  type ConditionNode,
  type Rule,
  type Ruleset,
} from "./dsl";

/** Flat record of feature values, produced by packages/triage. */
export type FeatureRecord = Record<string, unknown>;

function compare(
  featureValue: unknown,
  operator: string,
  value: unknown,
): boolean {
  switch (operator) {
    case "eq":
      return featureValue === value;
    case "neq":
      return featureValue !== value;
    case "gt":
      return typeof featureValue === "number" && typeof value === "number"
        ? featureValue > value
        : false;
    case "gte":
      return typeof featureValue === "number" && typeof value === "number"
        ? featureValue >= value
        : false;
    case "lt":
      return typeof featureValue === "number" && typeof value === "number"
        ? featureValue < value
        : false;
    case "lte":
      return typeof featureValue === "number" && typeof value === "number"
        ? featureValue <= value
        : false;
    case "in":
      return Array.isArray(value) && value.includes(featureValue);
    case "includes":
      return Array.isArray(featureValue) && featureValue.includes(value);
    default:
      return false;
  }
}

/**
 * Pure, deterministic condition-tree evaluation. Unknown feature keys
 * (missing from the record) evaluate the leaf as false rather than
 * throwing — a ruleset referencing a not-yet-computed feature simply never
 * fires that rule, instead of crashing the triage flow.
 */
export function evaluateCondition(
  node: ConditionNode,
  features: FeatureRecord,
): boolean {
  if ("all" in node) {
    return node.all.every((child) => evaluateCondition(child, features));
  }
  if ("any" in node) {
    return node.any.some((child) => evaluateCondition(child, features));
  }
  return compare(features[node.feature], node.operator, node.value);
}

export interface EvaluationResult {
  outcome: Rule["outcome"];
  firedRules: Rule[];
  reasons: Rule["reason"][];
}

/**
 * Evaluates every rule in the ruleset against `features` and returns the
 * highest-severity outcome among those that fired (urgent > assess_soon >
 * routine), with the reasons for only that winning tier. Pure — no I/O, no
 * wall-clock reads — so it's safe to run identically in Node or the browser.
 * This is the ONLY place triage urgency is decided (CLAUDE.md).
 */
export function evaluate(
  ruleset: Ruleset,
  features: FeatureRecord,
): EvaluationResult {
  const fired = ruleset.rules.filter((rule) =>
    evaluateCondition(rule.conditions, features),
  );

  if (fired.length === 0) {
    return { outcome: "routine", firedRules: [], reasons: [] };
  }

  const outcome = fired.reduce<Rule["outcome"]>(
    (worst, rule) =>
      OUTCOME_SEVERITY[rule.outcome] > OUTCOME_SEVERITY[worst]
        ? rule.outcome
        : worst,
    "routine",
  );

  const winningRules = fired
    .filter((rule) => rule.outcome === outcome)
    .sort((a, b) => b.priority - a.priority);

  return {
    outcome,
    firedRules: winningRules,
    reasons: winningRules.map((rule) => rule.reason),
  };
}
