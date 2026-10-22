import pino, { type DestinationStream, type Logger } from "pino";

const SENSITIVE_FIELDS = ["phone", "email", "notes", "content", "lat", "lng"];

/**
 * Structured logger for new/sensitive log sites (auth, chat pipeline,
 * retention jobs) — not a mechanical rewrite of every existing console.log.
 * `redact`'s `*.field` form matches that key at any nesting depth
 * (@pinojs/redact, pino's redaction engine), so this one list covers
 * phone/email/notes/content/lat/lng wherever they appear in a logged object
 * (CLAUDE.md: never log symptom content, precise location, or contact
 * details). Factored out as `createLogger` (accepting a destination) so
 * tests can point it at an in-memory stream instead of stdout.
 */
export function createLogger(destination?: DestinationStream): Logger {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      redact: {
        paths: SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`]),
        censor: "[redacted]",
      },
    },
    destination,
  );
}

export const logger = createLogger();
