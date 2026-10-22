"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { offlineDb } from "@/lib/offline-db";

export type SyncStatusSummary = "offline" | "syncing" | "synced";

function subscribeToOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

// Node's `navigator` global lacks `.onLine` (undefined, not a boolean), and
// the real browser value can't be known during SSR anyway — assume online
// for the server-rendered snapshot. useSyncExternalStore reconciles this
// with the real client value after hydration without a mismatch warning
// (unlike a useState+useEffect approach, which would render the wrong
// value on the server and flash-correct after mount).
function getServerOnlineSnapshot() {
  return true;
}

/** Drives the sync-status indicator from Dexie's pending-row count + online state. */
export function useSyncStatus(): SyncStatusSummary {
  const pendingCount = useLiveQuery(
    () => offlineDb.logs.where("syncStatus").equals("pending").count(),
    [],
    0,
  );
  const online = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

  if (!online) return "offline";
  if ((pendingCount ?? 0) > 0) return "syncing";
  return "synced";
}
