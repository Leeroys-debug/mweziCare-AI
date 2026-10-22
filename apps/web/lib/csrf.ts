import { problem } from "./problem-details";

/**
 * No Server Actions exist in this codebase (every mutation is a Route
 * Handler) — CSRF defense is an Origin/Referer check against the app's own
 * origin, since the session cookie alone (even SameSite=Lax) doesn't stop a
 * same-site top-level-navigation POST or an older/misconfigured browser.
 * Call at the top of every cookie-authenticated POST/PUT/DELETE/PATCH
 * handler, before reading the body.
 */
export function assertSameOrigin(request: Request): Response | null {
  const expected = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ).origin;

  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expected
      ? null
      : problem(403, "Forbidden", "Cross-origin request rejected");
  }

  // Fall back to Referer for browsers/requests that omit Origin on
  // same-origin requests (plain GETs never reach here, but some older
  // clients omit Origin on POST too) — still reject if neither is present.
  const referer = request.headers.get("referer");
  if (!referer) {
    return problem(403, "Forbidden", "Missing Origin/Referer header");
  }

  try {
    return new URL(referer).origin === expected
      ? null
      : problem(403, "Forbidden", "Cross-origin request rejected");
  } catch {
    return problem(403, "Forbidden", "Invalid Referer header");
  }
}
