import Dexie, { type Table } from "dexie";
import type { SymptomLogInput } from "@mwezicare/validation";

export type SyncStatus = "pending" | "synced";

export interface OfflineLog extends SymptomLogInput {
  syncStatus: SyncStatus;
  syncedAt?: string;
}

class MweziCareOfflineDB extends Dexie {
  logs!: Table<OfflineLog, string>;

  constructor() {
    super("mwezicare");
    this.version(1).stores({
      // clientId is the primary key — generated client-side (crypto.randomUUID())
      // before the first save, so it's stable across retries/offline edits.
      logs: "clientId, logDate, syncStatus",
    });
  }
}

export const offlineDb = new MweziCareOfflineDB();
