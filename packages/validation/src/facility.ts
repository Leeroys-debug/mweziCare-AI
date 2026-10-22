import { z } from "zod";

export const geoSearchQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(25),
  service: z.string().min(1).optional(),
  verifiedOnly: z.coerce.boolean().optional(),
});
export type GeoSearchQuery = z.infer<typeof geoSearchQuerySchema>;

export const areaSearchQuerySchema = z.object({
  county: z.string().min(1).optional(),
  q: z.string().min(1).optional(),
});
export type AreaSearchQuery = z.infer<typeof areaSearchQuerySchema>;

export const referralSchema = z.object({
  facilityId: z.string().uuid(),
  followUpConsent: z.boolean().optional(),
  // The triage outcome active when the referral was recorded, if the client
  // knows it (CarePage does) — forwarded into the referral_recorded
  // analytics event (packages/validation/analytics-events.ts).
  outcome: z.enum(["routine", "assess_soon", "urgent"]).optional(),
});
export type ReferralInput = z.infer<typeof referralSchema>;
