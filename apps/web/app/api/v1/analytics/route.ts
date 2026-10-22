import { NextResponse } from "next/server";
import { consumeRateLimitToken, track } from "@mwezicare/db";
import {
  clientAnalyticsEventSchema,
  type AnalyticsEventProps,
} from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * Ingress for the handful of events that only the client can observe
 * (right now, just urgent_screen_shown — the client-side red-flag check
 * right after a log save). Everything else is fired server-side where the
 * event already happens, so it can't be spoofed — see
 * packages/validation/analytics-events.ts's clientTriggeredEventTypes.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = clientAnalyticsEventSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid analytics event", parsed.error.message);

  const limit = await consumeRateLimitToken(
    db,
    `analytics:${user.id}`,
    60,
    60 / 3600,
  );
  if (!limit.allowed) return problem(429, "Too many analytics events");

  // track() re-validates props against the same per-event-type schema
  // (parseAnalyticsEventProps) — this cast just bridges the route's
  // necessarily-unknown input type to track()'s generic signature.
  await track(db, {
    userId: user.id,
    eventType: parsed.data.eventType,
    props: parsed.data.props as AnalyticsEventProps<
      typeof parsed.data.eventType
    >,
    analyticsKeyProvider,
  });

  return NextResponse.json({ ok: true });
}
