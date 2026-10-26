import {
  identitySchema,
  healthSchema,
  clinicalSchema,
  facilitiesSchema,
} from "./schemas";

export const roleEnum = identitySchema.enum("role", [
  "user",
  "clinician",
  "verifier",
  "programme_admin",
  "system_admin",
]);

export const consentPurposeEnum = identitySchema.enum("consent_purpose", [
  "tracking",
  "location",
  "research",
  "sharing",
]);

export const bleedingLevelEnum = healthSchema.enum("bleeding_level", [
  "none",
  "spotting",
  "light",
  "medium",
  "heavy",
  "very_heavy",
]);

export const triageOutcomeEnum = healthSchema.enum("triage_outcome", [
  "routine",
  "assess_soon",
  "urgent",
]);

export const rulesetStatusEnum = clinicalSchema.enum("ruleset_status", [
  "draft",
  "approved",
  "retired",
]);

export const kbStatusEnum = clinicalSchema.enum("kb_status", [
  "draft",
  "approved",
]);

export const serviceStatusEnum = facilitiesSchema.enum("service_status", [
  "listed",
  "verified",
  "unavailable",
]);

export const quizPromptKindEnum = healthSchema.enum("quiz_prompt_kind", [
  "onboarding",
  "day30",
]);

export const escalationVerdictEnum = healthSchema.enum("escalation_verdict", [
  "appropriate",
  "inappropriate",
  "uncertain",
]);
