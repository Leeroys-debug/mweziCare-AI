import { NextResponse } from "next/server";
import { getFacilityForStaffReview } from "@mwezicare/facilities";
import { problem } from "@/lib/problem-details";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const STAFF_READ_ROLES = [
  "verifier",
  "programme_admin",
  "system_admin",
] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const facility = await getFacilityForStaffReview(db, id);
  if (!facility) return problem(404, "Facility not found");

  return NextResponse.json({ facility });
}
