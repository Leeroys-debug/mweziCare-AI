import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runAnalyticsRefresh } from "@/worker/jobs/analytics-refresh";

/** Vercel Cron equivalent of worker/index.ts's nightly analytics.refresh schedule — see vercel.json. */
export async function GET(request: Request) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  await runAnalyticsRefresh();
  return NextResponse.json({ ok: true });
}
