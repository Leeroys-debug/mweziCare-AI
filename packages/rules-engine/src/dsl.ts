import { z } from "zod";

export const operatorSchema = z.enum([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "includes",
]);
export type Operator = z.infer<typeof operatorSchema>;

export interface LeafCondition {
  feature: string;
  operator: Operator;
  value?: unknown;
}

export interface AllCondition {
  all: ConditionNode[];
}

export interface AnyCondition {
  any: ConditionNode[];
}

/**
 * A condition tree: a leaf feature comparison, or an `all`/`any` node
 * nesting further conditions. `{ all: [] }` is vacuously true (used by the
 * routine catch-all rule); `{ any: [] }` is vacuously false.
 */
export type ConditionNode = LeafCondition | AllCondition | AnyCondition;

const leafSchema = z.object({
  feature: z.string().min(1),
  operator: operatorSchema,
  value: z.unknown(),
});

export const conditionSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    leafSchema,
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
  ]),
);

export const triageOutcomeSchema = z.enum(["routine", "assess_soon", "urgent"]);
export type TriageOutcome = z.infer<typeof triageOutcomeSchema>;

/** Highest first — used by evaluate() to pick the winning outcome. */
export const OUTCOME_SEVERITY: Record<TriageOutcome, number> = {
  routine: 0,
  assess_soon: 1,
  urgent: 2,
};

export const localizedTextSchema = z.object({
  en: z.string().min(1),
  sw: z.string().min(1),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export const ruleSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  priority: z.number().int(),
  outcome: triageOutcomeSchema,
  conditions: conditionSchema,
  reason: localizedTextSchema,
  clinicianNote: z.string().min(1),
});
export type Rule = z.infer<typeof ruleSchema>;

export const rulesetStatusSchema = z.enum(["draft", "approved", "retired"]);
export type RulesetStatus = z.infer<typeof rulesetStatusSchema>;

export const rulesetSchema = z.object({
  version: z.number().int().positive(),
  status: rulesetStatusSchema,
  rules: z.array(ruleSchema).min(1),
});
export type Ruleset = z.infer<typeof rulesetSchema>;
