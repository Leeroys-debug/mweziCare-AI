import { z } from "zod";

export const bleedingLevelSchema = z.enum([
  "none",
  "spotting",
  "light",
  "medium",
  "heavy",
  "very_heavy",
]);
export type BleedingLevel = z.infer<typeof bleedingLevelSchema>;

export const painLocationSchema = z.enum([
  "lower_abdomen",
  "lower_back",
  "pelvis",
  "legs",
  "other",
]);
export type PainLocation = z.infer<typeof painLocationSchema>;

export const symptomFlagsSchema = z.object({
  fatigue: z.boolean(),
  nausea: z.boolean(),
  painWithBowelMovements: z.boolean(),
  painWithUrination: z.boolean(),
  // Only shown in the UI for 18+ age bands — accepted here regardless since
  // age-gating is a UI concern, not a trust boundary worth enforcing server-side.
  painWithSex: z.boolean().optional(),
});
export type SymptomFlags = z.infer<typeof symptomFlagsSchema>;

export const impactFlagsSchema = z.object({
  missedSchool: z.boolean(),
  missedWork: z.boolean(),
  sleepDisrupted: z.boolean(),
  activitiesLimited: z.boolean(),
});
export type ImpactFlags = z.infer<typeof impactFlagsSchema>;

/**
 * Independent-of-history urgent red-flag inputs, captured as part of every
 * daily log so the client-side urgent screen (packages/rules-engine's
 * urgentOnlyRuleset) has something to evaluate immediately after save, even
 * offline. See CLAUDE.md: urgency is only ever decided by the rules engine.
 */
export const redFlagsSchema = z.object({
  suddenSeverePain: z.boolean(),
  fainting: z.boolean(),
  possiblePregnancySuspected: z.boolean(),
});
export type RedFlags = z.infer<typeof redFlagsSchema>;

export const symptomLogSchema = z.object({
  clientId: z.string().uuid(),
  logDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "logDate must be YYYY-MM-DD"),
  periodDay: z.boolean(),
  bleedingLevel: bleedingLevelSchema.nullish(),
  painScore: z.number().int().min(0).max(10).nullish(),
  painLocations: z.array(painLocationSchema).default([]),
  symptoms: symptomFlagsSchema,
  impact: impactFlagsSchema,
  redFlags: redFlagsSchema,
  notes: z.string().max(2000).nullish(),
  /** Client wall-clock ISO timestamp — server upserts last-write-wins on this. */
  updatedAt: z.string().datetime(),
});
export type SymptomLogInput = z.infer<typeof symptomLogSchema>;

export const logsBatchSchema = z.object({
  logs: z.array(symptomLogSchema).min(1).max(100),
});
export type LogsBatchInput = z.infer<typeof logsBatchSchema>;
