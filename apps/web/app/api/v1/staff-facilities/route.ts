import { NextResponse } from "next/server";
import { listForStaffReview } from "@mwezicare/facilities";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const STAFF_READ_ROLES = [
  "verifier",
  "programme_admin",
  "system_admin",
] as const;

const VALID_STATUSES = new Set(["listed", "verified", "unavailable"]);

/** Facilities (GYN service) with county/status/due-for-reverification filters. */
export async function GET(request: Request) {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const url = new URL(request.url);
  const county = url.searchParams.get("county") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.has(statusParam)
      ? (statusParam as "listed" | "verified" | "unavailable")
      : undefined;
  const dueOnly = url.searchParams.get("dueForReverification") === "1";

  const facilities = await listForStaffReview(db, {
    county,
    status,
    dueForReverificationOnly: dueOnly,
  });

  return NextResponse.json({ facilities });
}
