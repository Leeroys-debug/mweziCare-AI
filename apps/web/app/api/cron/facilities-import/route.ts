import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runFacilitiesImport } from "@/worker/jobs/facilities-import";

/** Vercel Cron equivalent of worker/index.ts's weekly facilities.import schedule — see vercel.json. */
export async function GET(request: Request) {
  const authError = verifyCronRequest(request);
  if (authError) return authError;

  await runFacilitiesImport();
  return NextResponse.json({ ok: true });
}
