"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Generic "you're viewing cached data" banner for pages whose data comes
 * from a GET the service worker may be serving from cache (Serwist's
 * NetworkFirst for /api/* — app/sw.ts) rather than fresh from the network.
 */
export function OfflineBanner() {
  const t = useTranslations("Sync");
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {t("offline")}
    </div>
  );
}
