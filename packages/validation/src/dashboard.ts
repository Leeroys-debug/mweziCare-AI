import { z } from "zod";

export const dashboardViewNameSchema = z.enum([
  "weekly_county_age",
  "weekly_active_users",
  "logs_per_active_user",
  "outcome_distribution",
  "referrals_per_outcome",
  "knowledge_score_change",
  "language_split",
  "referral_follow_up_rate",
  "time_to_care_seeking",
]);

export const dashboardQuerySchema = z.object({
  view: dashboardViewNameSchema,
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  county: z.string().min(1).optional(),
  ageBand: z.string().min(1).optional(),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
