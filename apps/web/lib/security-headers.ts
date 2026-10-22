import type { NextResponse } from "next/server";

/**
 * Security headers (F1 spec) — applied to every response, page or API, from
 * `proxy.ts`. Split into its own module (rather than living in proxy.ts
 * directly) so it can be unit-tested without pulling in `next-intl/
 * middleware`'s import chain, which doesn't resolve under Vitest's Node
 * environment.
 *
 * CSP uses a fresh per-request nonce: Next's own documented pattern is to
 * forward it as a request header (`x-nonce`) so `app/layout.tsx` can read
 * it via `headers()`, and Next's own inline bootstrap scripts automatically
 * pick up a nonce found this way. `script-src` also keeps `'unsafe-inline'`
 * as a no-op fallback for browsers that don't understand nonces/
 * strict-dynamic (modern browsers ignore it once a nonce is present).
 *
 * `worker-src`/extra `img-src`/`connect-src` entries exist specifically for
 * maplibre-gl (Care tab's facility map — Web Workers, WASM via blob: URLs,
 * and OSM raster tiles from tile.openstreetmap.org, see
 * components/care/facility-map.tsx). `style-src` keeps 'unsafe-inline'
 * because React/maplibre-gl/recharts all set inline `style` attributes —
 * tightening that further would need per-element nonces these libraries
 * don't support.
 *
 * [REVIEW REQUIRED] This hasn't been exercised against a live browser
 * session in this environment — verify no console CSP violations on every
 * page (especially Care's map and the chat SSE stream) before relying on
 * it in production.
 */
export function applySecurityHeaders<T extends NextResponse>(
  response: T,
  nonce: string,
): T {
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://tile.openstreetmap.org`,
    `font-src 'self' data:`,
    `connect-src 'self' https://tile.openstreetmap.org${isDev ? " ws: wss:" : ""}`,
    `worker-src 'self' blob:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `form-action 'self'`,
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=(), payment=()",
  );
  response.headers.set("X-Frame-Options", "DENY");
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return response;
}
