export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * Service-worker navigation fallback (app/sw.ts's `fallbacks` config) —
 * shown when a page that isn't already cached is requested while offline.
 * Deliberately outside [locale] and not using next-intl: it has to render
 * from the precache alone, with no network and no guarantee the locale
 * middleware's own chunks are cached, so it shows both languages at once
 * rather than depending on locale detection.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      <div>
        <h1 className="text-xl font-semibold">You&rsquo;re offline</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          This page hasn&rsquo;t been saved for offline use yet. Tracking, your
          calendar, saved articles, and your last facility search still work
          offline — go back and try one of those, or reconnect and try this page
          again.
        </p>
      </div>
      <div>
        <h2 className="text-xl font-semibold">Hauko mtandaoni</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Ukurasa huu haujahifadhiwa bado kwa matumizi nje ya mtandao.
          Kufuatilia, kalenda yako, makala zilizohifadhiwa, na utafutaji wako wa
          mwisho wa vituo bado vinafanya kazi nje ya mtandao — rudi nyuma na
          ujaribu mojawapo ya hivyo, au unganisha tena na ujaribu ukurasa huu
          tena.
        </p>
      </div>
    </main>
  );
}
