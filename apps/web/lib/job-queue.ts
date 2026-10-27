import PgBoss from "pg-boss";
import { loadServerEnv } from "@mwezicare/validation";
import {
  JOB_KB_INGEST,
  runKbIngest,
  type KbIngestJobData,
} from "../worker/jobs/kb-ingest";

/**
 * A short-lived pg-boss client just for enqueuing a job from a Next.js
 * request — the actual work happens in the separate worker process
 * (apps/web/worker/index.ts), which already has this queue's `work()`
 * handler registered. Creating/stopping a client per call is wasteful under
 * load, but kb.ingest only fires on a clinician's approve/save click, so
 * it's not a hot path.
 *
 * On Vercel (`process.env.VERCEL` is set by the platform) there's no
 * persistent worker process to ever pick this up, so this runs the ingest
 * inline instead — a single article's chunk/embed step is well within a
 * serverless function's time budget, just without pg-boss's retry/backoff.
 */
export async function enqueueKbIngest(documentId: string): Promise<void> {
  const data: KbIngestJobData = { documentId };

  if (process.env.VERCEL) {
    await runKbIngest(data);
    return;
  }

  const env = loadServerEnv();
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  await boss.start();
  try {
    await boss.send(JOB_KB_INGEST, data);
  } finally {
    await boss.stop({ graceful: false, close: true });
  }
}
