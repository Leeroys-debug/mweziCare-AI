import { NextResponse } from "next/server";
import { listTriageLogs, withUser } from "@mwezicare/db";
import {
  deriveCycles,
  estimateNextPeriod,
  summarizeCyclesForCharts,
} from "@mwezicare/triage";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/** Server-side cycle detection — see packages/triage/src/cycles.ts. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const requested = Number(new URL(request.url).searchParams.get("cycles"));
  const limit =
    Number.isInteger(requested) && requested > 0 && requested <= 24
      ? requested
      : 6;

  const logs = await withUser(db, user.id, (tx) => listTriageLogs(tx, user.id));

  const cycles = deriveCycles(logs);
  const nextPeriodEstimate = estimateNextPeriod(cycles);
  const chartData = summarizeCyclesForCharts(logs, cycles, limit);

  // `logs` lets the Insights page drill into a single cycle's day-by-day
  // entries client-side (via cycleDateRange/logsInRange, already pure
  // functions in @mwezicare/triage) without a second round trip — it's the
  // user's own data, already scoped to them above.
  return NextResponse.json({ cycles, nextPeriodEstimate, chartData, logs });
}
