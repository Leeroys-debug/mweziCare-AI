import type { ClientTriggeredEventType } from "@mwezicare/validation";

/**
 * Fire-and-forget client-side analytics reporting — only for the event
 * types packages/validation's clientAnalyticsEventSchema actually allows
 * (right now just urgent_screen_shown). Never throws into the caller;
 * analytics is never on the critical path of a user action.
 */
export async function trackClientEvent(
  eventType: ClientTriggeredEventType,
  props: Record<string, never>,
): Promise<void> {
  try {
    await fetch("/api/v1/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, props }),
    });
  } catch {
    // Best-effort.
  }
}
