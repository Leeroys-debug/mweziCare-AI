import { queryDashboardView } from "@mwezicare/db";
import { dashboardQuerySchema } from "@mwezicare/validation";
import { problem } from "@/lib/problem-details";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvCell(row[column])).join(","));
  }
  return lines.join("\n");
}

/**
 * CSV export of one materialised view's (already small-cell-suppressed)
 * aggregates — never raw analytics.events rows. Same filters/role as
 * GET /api/v1/dashboard, so what's on screen is exactly what's exported.
 */
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

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${parsed.data.view}.csv"`,
    },
  });
}
