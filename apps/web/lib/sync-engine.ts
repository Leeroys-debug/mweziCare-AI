import type { SymptomLogInput } from "@mwezicare/validation";
import { offlineDb, type OfflineLog } from "./offline-db";

const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 60_000;

let backoffMs = INITIAL_BACKOFF_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let syncing = false;
let initialized = false;

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    void syncPendingLogs();
  }, backoffMs);
}

/** Saves a log locally first (offline-first), then kicks a sync attempt. */
export async function saveLog(log: SymptomLogInput): Promise<void> {
  const record: OfflineLog = { ...log, syncStatus: "pending" };
  await offlineDb.logs.put(record);
  void syncPendingLogs();
}

/**
 * POSTs every pending log in one batch and reconciles each local row with
 * the server's canonical result (see packages/db's upsertSymptomLog —
 * "unchanged" can mean either an idempotent retry or a stale write that lost
 * to a newer one; either way the server's returned log is authoritative).
 * Retries with exponential backoff while online; while offline, waits for
 * the 'online' event instead of spinning.
 */
export async function syncPendingLogs(): Promise<void> {
  if (syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const pending = await offlineDb.logs
    .where("syncStatus")
    .equals("pending")
    .toArray();
  if (pending.length === 0) return;

  syncing = true;
  try {
    const response = await fetch("/api/v1/logs/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logs: pending.map(
          ({ syncStatus: _status, syncedAt: _syncedAt, ...log }) => log,
        ),
      }),
    });
    if (!response.ok)
      throw new Error(`Sync failed with status ${response.status}`);

    const { results } = (await response.json()) as {
      results: Array<{
        clientId: string;
        status: string;
        log: SymptomLogInput;
      }>;
    };

    await Promise.all(
      results.map(({ clientId, log }) => {
        const { clientId: _serverClientId, ...rest } = log;
        return offlineDb.logs.update(clientId, {
          ...rest,
          syncStatus: "synced",
          syncedAt: new Date().toISOString(),
        });
      }),
    );

    backoffMs = INITIAL_BACKOFF_MS;
    const remaining = await offlineDb.logs
      .where("syncStatus")
      .equals("pending")
      .count();
    if (remaining === 0) {
      // Best-effort: triggers the latest triage assessment after a clean
      // sync. Not on the critical path — failures here are swallowed.
      void fetch("/api/v1/assessments", { method: "POST" }).catch(() => {});
    } else {
      scheduleRetry();
    }
  } catch {
    scheduleRetry();
  } finally {
    syncing = false;
  }
}

/** Registers the online listener and kicks an initial sync attempt. Call once (e.g. from the (user) layout). */
export function initSyncEngine(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => {
    backoffMs = INITIAL_BACKOFF_MS;
    void syncPendingLogs();
  });
  void syncPendingLogs();
}
