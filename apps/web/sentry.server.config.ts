import * as Sentry from "@sentry/nextjs";
import { scrubSentryEvent } from "./lib/sentry-scrub";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // scrubSentryEvent is typed against a plain object (so it's testable
    // without Sentry's SDK types) — Event is structurally a deeply nested
    // record, so this reshape is safe despite the cast.
    beforeSend: (event) =>
      scrubSentryEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as Sentry.ErrorEvent,
  });
}
