import { z } from "zod";

/** The verifier's call-script checklist (staff facilities console). */
export const callScriptSchema = z.object({
  phoneConfirmed: z.boolean(),
  gynAvailable: z.boolean(),
  daysHours: z.string().max(200),
  referralNeeded: z.boolean(),
  costInfo: z.string().max(500),
});

export const verifyFacilityServiceSchema = z.object({
  status: z.enum(["verified", "unavailable"]),
  notes: z.string().max(2000),
  callScript: callScriptSchema,
});

export type VerifyFacilityServiceInput = z.infer<
  typeof verifyFacilityServiceSchema
>;
