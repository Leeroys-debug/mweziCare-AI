const SENSITIVE_KEY_PATTERN = /phone|email|notes|content|lat|lng/i;

function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[redacted]"
        : redactDeep(val);
    }
    return out;
  }
  return value;
}

/**
 * Sentry `beforeSend` (F1 spec) — none of this app's health data belongs in
 * a third-party error tracker (CLAUDE.md), so this drops the request body,
 * cookies, headers, and query string outright rather than trying to redact
 * within them, then walks whatever's left (user context, extra, tags,
 * contexts) and redacts any key matching phone/email/notes/content/lat/lng
 * as a defense-in-depth pass for anything attached via `Sentry.setContext`/
 * `setExtra` elsewhere in the app.
 */
export function scrubSentryEvent<T extends Record<string, unknown>>(
  event: T,
): T {
  const scrubbed: Record<string, unknown> = { ...event };

  const request = scrubbed.request as Record<string, unknown> | undefined;
  if (request) {
    scrubbed.request = { url: request.url, method: request.method };
  }

  for (const field of ["user", "extra", "contexts", "tags"]) {
    if (scrubbed[field]) scrubbed[field] = redactDeep(scrubbed[field]);
  }

  return scrubbed as T;
}
