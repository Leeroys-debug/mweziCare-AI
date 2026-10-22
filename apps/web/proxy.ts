import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { auth } from "./lib/auth";
import { applySecurityHeaders } from "./lib/security-headers";

// Proxy (Next 16's successor to middleware) always runs on Node.js now —
// no runtime export needed or allowed — so DB access via getSession works.
const intlMiddleware = createMiddleware(routing);

const STAFF_ROLES = new Set([
  "clinician",
  "verifier",
  "programme_admin",
  "system_admin",
]);

function matchesStaffRoute(pathname: string): string | null {
  for (const locale of routing.locales) {
    if (
      pathname === `/${locale}/dashboard` ||
      pathname.startsWith(`/${locale}/dashboard/`)
    ) {
      return locale;
    }
  }
  return null;
}

/**
 * Coarse redirect for (staff) routes — the real gate is requireRole()
 * inside the layout/handler itself (CLAUDE.md: "role checks run in
 * middleware for routing and again inside every route handler").
 */
export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // API routes don't need locale routing or the staff coarse-redirect
  // (every API route already role-checks itself — CLAUDE.md), just headers.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      nonce,
    );
  }

  const staffLocale = matchesStaffRoute(request.nextUrl.pathname);
  if (staffLocale) {
    const session = await auth.api.getSession({ headers: request.headers });
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (!session || !role || !STAFF_ROLES.has(role)) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL(`/${staffLocale}`, request.url)),
        nonce,
      );
    }
  }

  const response = intlMiddleware(
    new NextRequest(request, { headers: requestHeaders }),
  );
  return applySecurityHeaders(response, nonce);
}

export const config = {
  // /offline is excluded from locale routing — it's the service worker's
  // locale-agnostic navigation fallback (app/sw.ts), so it must resolve at
  // a fixed URL, not get redirected to /en/offline or /sw/offline by
  // next-intl's middleware. /api IS included now (see proxy() above) so
  // every response gets security headers, not just pages.
  matcher: ["/((?!_next|_vercel|s/|offline|.*\\..*).*)"],
};
