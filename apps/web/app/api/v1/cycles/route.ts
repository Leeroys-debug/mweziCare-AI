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
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const logs = await withUser(db, user.id, (tx) => listTriageLogs(tx, user.id));

  const cycles = deriveCycles(logs);
  const nextPeriodEstimate = estimateNextPeriod(cycles);
  const chartData = summarizeCyclesForCharts(logs, cycles);

  return NextResponse.json({ cycles, nextPeriodEstimate, chartData });
}
