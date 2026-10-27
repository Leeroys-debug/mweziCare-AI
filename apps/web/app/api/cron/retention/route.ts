import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runRetention } from "@/worker/jobs/retention";

/** Vercel Cron equivalent of worker/index.ts's nightly retention.purge schedule — see vercel.json. */
export async function GET(request: Request) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  await runRetention();
  return NextResponse.json({ ok: true });
}
