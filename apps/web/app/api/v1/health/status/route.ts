import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/server-db";

interface QueueStatus {
  queue: string;
  oldestPendingJobAgeSeconds: number;
}

/**
 * Deployment health check (F2 spec) — what an ECS/ALB target-group health
 * check and an external uptime monitor hit. Distinct from the pre-existing
 * `GET /api/v1/health` (a trivial, unrelated static `{status:"ok"}`
 * route) — point infrastructure here, not there. No auth: load balancers
 * and uptime monitors don't carry a session, same as every other health
 * endpoint convention.
 *
 * Checks two things independently so a failure names the actual problem:
 * - Postgres connectivity (`select 1`).
 * - pg-boss queue status: the oldest still-pending ("created"/"retry"
 *   state) job's age per queue, read directly from pg-boss's own job table
 *   (packages `pg-boss` doesn't expose this via its public API — only
 *   counts, via getQueueSize — so this reads pgboss.job directly, the same
 *   schema/table pg-boss itself creates. node_modules/pg-boss/src/plans.js
 *   confirms the schema name and column names this depends on).
 *
 * Deliberately does NOT check third-party dependencies (AI Gateway,
 * Africa's Talking) — those failing shouldn't page on-call for the whole
 * app being down (see docs/deploy.md).
 */
export async function GET() {
  const checks: { database: "ok" | "failed"; queue: "ok" | "failed" } = {
    database: "failed",
    queue: "failed",
  };
  let queues: QueueStatus[] = [];

  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    // checks.database stays "failed"
  }

  try {
    const rows = await db.execute<{
      queue: string;
      oldest_pending: string;
    }>(sql`
      select name as queue, min(created_on) as oldest_pending
      from pgboss.job
      where state in ('created', 'retry')
      group by name
    `);
    queues = rows.map((row) => ({
      queue: row.queue,
      oldestPendingJobAgeSeconds: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(row.oldest_pending).getTime()) / 1000,
        ),
      ),
    }));
    checks.queue = "ok";
  } catch {
    // checks.queue stays "failed" — e.g. pg-boss's schema doesn't exist
    // yet (worker has never started), which is itself a real signal.
  }

  const healthy = checks.database === "ok" && checks.queue === "ok";
  const body = { status: healthy ? "ok" : "unhealthy", checks, queues };

  return NextResponse.json(body, { status: healthy ? 200 : 503 });
}
