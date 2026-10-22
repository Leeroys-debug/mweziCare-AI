import PgBoss from "pg-boss";
import { loadServerEnv } from "@mwezicare/validation";
import { JOB_KB_INGEST, type KbIngestJobData } from "../worker/jobs/kb-ingest";

/**
 * A short-lived pg-boss client just for enqueuing a job from a Next.js
 * request — the actual work happens in the separate worker process
 * (apps/web/worker/index.ts), which already has this queue's `work()`
 * handler registered. Creating/stopping a client per call is wasteful under
 * load, but kb.ingest only fires on a clinician's approve/save click, so
 * it's not a hot path.
 */
export async function enqueueKbIngest(documentId: string): Promise<void> {
  const env = loadServerEnv();
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  await boss.start();
  try {
    const data: KbIngestJobData = { documentId };
    await boss.send(JOB_KB_INGEST, data);
  } finally {
    await boss.stop({ graceful: false, close: true });
  }
}
