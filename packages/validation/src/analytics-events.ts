import { z } from "zod";

const triageOutcomeSchema = z.enum(["routine", "assess_soon", "urgent"]);

/**
 * One strict zod schema per analytics event type — `.strict()` means an
 * unknown/extra prop fails validation outright rather than being silently
 * stored, which is what proves "no event payload can contain disallowed
 * fields" (E1 acceptance criterion). No free text, no coordinates, no
 * timestamps finer than the day in any of these (CLAUDE.md).
 */
export const analyticsEventSchemas = {
  signup_completed: z.object({}).strict(),
  log_saved: z.object({}).strict(),
  assessment_generated: z.object({ outcome: triageOutcomeSchema }).strict(),
  urgent_screen_shown: z.object({}).strict(),
  facility_search: z
    .object({
      mode: z.enum(["geo", "area"]),
      resultCount: z.number().int().min(0),
      verifiedCount: z.number().int().min(0),
    })
    .strict(),
  referral_recorded: z
    .object({ outcome: triageOutcomeSchema.optional() })
    .strict(),
  summary_created: z.object({}).strict(),
  summary_viewed: z.object({}).strict(),
  chat_message: z.object({ inScope: z.boolean() }).strict(),
  knowledge_quiz_completed: z
    .object({
      scoreBand: z.enum(["0-2", "3-4", "5"]),
      promptKind: z.enum(["onboarding", "day30"]),
      // Only present for a "day30" attempt — derived server-side from that
      // same user's earlier attempt, never the raw scores (packages/db's track()).
      scoreChangeBand: z.enum(["improved", "same", "declined"]).optional(),
    })
    .strict(),
} as const satisfies Record<string, z.ZodTypeAny>;

export type AnalyticsEventType = keyof typeof analyticsEventSchemas;
export type AnalyticsEventProps<T extends AnalyticsEventType> = z.infer<
  (typeof analyticsEventSchemas)[T]
>;

export const analyticsEventTypes = Object.keys(
  analyticsEventSchemas,
) as AnalyticsEventType[];

/** Validates (and strips any ambient extra keys from) props for a given event type. */
export function parseAnalyticsEventProps<T extends AnalyticsEventType>(
  eventType: T,
  props: unknown,
): AnalyticsEventProps<T> {
  return analyticsEventSchemas[eventType].parse(
    props ?? {},
  ) as AnalyticsEventProps<T>;
}

/**
 * Event types a client is allowed to report directly via POST /api/v1/analytics
 * (everything else is only ever fired from a trusted server-side code path,
 * so a client can't fabricate e.g. a fake assessment outcome). chat_message
 * is fired server-side instead, inside the chat route handler, which
 * already knows the pipeline's in_scope/out_of_scope category — not here,
 * to avoid a client call double-counting it.
 */
export const clientTriggeredEventTypes = ["urgent_screen_shown"] as const;
export type ClientTriggeredEventType =
  (typeof clientTriggeredEventTypes)[number];

export const clientAnalyticsEventSchema = z.object({
  eventType: z.enum(clientTriggeredEventTypes),
  props: z.unknown(),
});
