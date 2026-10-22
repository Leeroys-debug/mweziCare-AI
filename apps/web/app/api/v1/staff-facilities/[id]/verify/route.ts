import { NextResponse } from "next/server";
import {
  getFacilityForStaffReview,
  verifyFacilityService,
} from "@mwezicare/facilities";
import { verifyFacilityServiceSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/** Records a verifier's call outcome: status, date (now), notes, and the call-script checklist. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["verifier"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = verifyFacilityServiceSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid verification", parsed.error.message);

  const existing = await getFacilityForStaffReview(db, id);
  if (!existing) return problem(404, "Facility not found");

  await verifyFacilityService(db, {
    facilityId: id,
    status: parsed.data.status,
    verifiedBy: roleCheck.user.id,
    notes: parsed.data.notes,
    callScript: parsed.data.callScript,
  });
  await logAccess(roleCheck.user.id, "facility_verify", "facility", id);

  return NextResponse.json({ ok: true });
}
