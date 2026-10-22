"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { initSyncEngine } from "@/lib/sync-engine";
import { cn } from "@mwezicare/ui";

const DOT_CLASSES: Record<string, string> = {
  offline: "bg-amber-500",
  syncing: "bg-sky-500 animate-pulse",
  synced: "bg-emerald-600",
};

export function SyncStatusIndicator() {
  const t = useTranslations("Sync");
  const status = useSyncStatus();

  useEffect(() => {
    initSyncEngine();
  }, []);

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 py-1 text-xs text-neutral-600 dark:text-neutral-400"
    >
      <span
        className={cn("h-2 w-2 rounded-full", DOT_CLASSES[status])}
        aria-hidden="true"
      />
      <span>{t(status)}</span>
    </div>
  );
}
