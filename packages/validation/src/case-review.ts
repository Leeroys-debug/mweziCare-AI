import { z } from "zod";

export const escalationVerdictSchema = z.enum([
  "appropriate",
  "inappropriate",
  "uncertain",
]);

export const assessmentReviewSchema = z.object({
  verdict: escalationVerdictSchema,
  note: z.string().trim().max(2000).optional(),
});
export type AssessmentReview = z.infer<typeof assessmentReviewSchema>;
