import { config } from "dotenv";
import PgBoss from "pg-boss";
import { loadServerEnv } from "@mwezicare/validation";
import { runAnalyticsRefresh } from "./jobs/analytics-refresh";
import { runFacilitiesImport } from "./jobs/facilities-import";
import {
  JOB_KB_INGEST,
  runKbIngest,
  type KbIngestJobData,
} from "./jobs/kb-ingest";
import { runRetention } from "./jobs/retention";

config({ path: "../../.env" });

const JOB_FACILITIES_IMPORT = "facilities.import";
const JOB_ANALYTICS_REFRESH = "analytics.refresh";
const JOB_RETENTION = "retention.purge";

/**
 * pg-boss worker process — runs from the same image as the web app, as a
 * separate process (see docs/MweziCare_AI_Technical_Architecture.docx
 * "Runtime components"). facilities.import, analytics.refresh and
 * retention.purge run on a schedule; kb.ingest is on-demand only, enqueued
 * by the staff knowledge-base console (see apps/web/lib/job-queue.ts).
 */
async function main() {
  const env = loadServerEnv();
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });

  boss.on("error", (error) => console.error("pg-boss error", error));

  await boss.start();

  await boss.createQueue(JOB_FACILITIES_IMPORT);
  await boss.work(JOB_FACILITIES_IMPORT, async () => {
    await runFacilitiesImport();
  });
  await boss.schedule(
    JOB_FACILITIES_IMPORT,
    "0 3 * * 0",
    {},
    { tz: "Africa/Nairobi" },
  );

  await boss.createQueue(JOB_ANALYTICS_REFRESH);
  await boss.work(JOB_ANALYTICS_REFRESH, async () => {
    await runAnalyticsRefresh();
  });
  await boss.schedule(
    JOB_ANALYTICS_REFRESH,
    "0 2 * * *",
    {},
    { tz: "Africa/Nairobi" },
  );

  await boss.createQueue(JOB_KB_INGEST);
  await boss.work<KbIngestJobData>(JOB_KB_INGEST, async (jobs) => {
    for (const job of jobs) {
      await runKbIngest(job.data);
    }
  });

  await boss.createQueue(JOB_RETENTION);
  await boss.work(JOB_RETENTION, async () => {
    await runRetention();
  });
  await boss.schedule(JOB_RETENTION, "0 4 * * *", {}, { tz: "Africa/Nairobi" });

  console.log(
    "Worker started — facilities.import weekly (Sun 03:00), analytics.refresh nightly (02:00), retention.purge nightly (04:00, Africa/Nairobi); kb.ingest on-demand.",
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
