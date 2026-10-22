import { z } from "zod";

export const ageBandSchema = z.enum([
  "13-15",
  "16-17",
  "18-20",
  "21-24",
  "25+",
]);
export const MINOR_AGE_BANDS = new Set<string>(["13-15", "16-17"]);

export const onboardingSchema = z.object({
  ageBand: ageBandSchema,
  county: z.string().trim().min(1).max(100),
  consents: z.object({
    tracking: z.literal(true),
    location: z.boolean(),
    research: z.boolean(),
    sharing: z.boolean(),
  }),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
