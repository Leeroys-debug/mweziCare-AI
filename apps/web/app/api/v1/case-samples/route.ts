import { NextResponse } from "next/server";
import { listCaseSamples } from "@/lib/case-samples";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

export async function GET() {
  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const samples = await listCaseSamples(db);
  return NextResponse.json({ samples });
}
