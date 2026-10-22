import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    // No session-replay integration — it screenshots the DOM, which on this
    // app's /track and /insights pages would capture symptom/pain data
    // (CLAUDE.md: never transmit symptom content to a third party).
    beforeSend: (event) =>
      scrubSentryEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as Sentry.ErrorEvent,
  });
}
