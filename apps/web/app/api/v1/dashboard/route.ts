import { NextResponse } from "next/server";
import { queryDashboardView } from "@mwezicare/db";
import { dashboardQuerySchema } from "@mwezicare/validation";
import { problem } from "@/lib/problem-details";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/** One materialised view's filtered rows, for the programme_admin dashboard's charts/tiles. */
export async function GET(request: Request) {
  const roleCheck = await requireApiRole(["programme_admin"]);
  if (!roleCheck.ok) return roleCheck.response;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = dashboardQuerySchema.safeParse(params);
  if (!parsed.success)
    return problem(400, "Invalid dashboard query", parsed.error.message);

  const rows = await queryDashboardView(db, parsed.data.view, {
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    county: parsed.data.county,
    ageBand: parsed.data.ageBand,
  });

  return NextResponse.json({ view: parsed.data.view, rows });
}
