import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

// Bump this when app/offline/page.tsx's content changes materially, so the
// service worker re-precaches it instead of serving a stale copy forever.
const OFFLINE_FALLBACK_REVISION = "1";

// defaultCache (production only — it's NetworkOnly everywhere in dev) is
// already cache-first for static assets (JS/CSS/fonts/images) and
// network-first (10s timeout, cache fallback) for same-origin GETs,
// including /api/* and page navigations — see
// node_modules/@serwist/next's index.worker.ts. That's what keeps cached
// insights, saved Learn articles, and the last Care facility search
// available offline: all three are either a GET to /api/v1/* or a
// server-rendered page Serwist already cached on first (online) visit.
// Offline symptom logging is handled entirely by apps/web/lib/sync-engine.ts
// (Dexie-backed, outside the service worker) — not duplicated here.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        revision: OFFLINE_FALLBACK_REVISION,
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
