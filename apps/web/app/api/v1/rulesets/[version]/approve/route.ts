import { NextResponse } from "next/server";
import { approveRuleset, getRulesetMeta } from "@mwezicare/db";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const approveSchema = z.object({
  clinicianName: z.string().trim().min(2).max(200),
});

/**
 * Approves a draft ruleset — the clinician must type their name (sent as
 * clinicianName), stored as a plain-text attestation alongside the
 * approving user's id. Retires whichever version was previously approved.
 * Rejects a version that isn't currently draft (already approved/retired).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ version: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { version: versionParam } = await params;
  const version = Number(versionParam);
  if (!Number.isInteger(version) || version <= 0)
    return problem(400, "Invalid version");

  const body = await request.json().catch(() => null);
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return problem(
      400,
      "Clinician name is required to approve",
      parsed.error.message,
    );
  }

  const meta = await getRulesetMeta(db, version);
  if (!meta) return problem(404, "Ruleset version not found");
  if (meta.status !== "draft") {
    return problem(
      409,
      "Only a draft ruleset can be approved",
      `Version ${version} is ${meta.status}`,
    );
  }

  await approveRuleset(db, {
    rulesetId: meta.id,
    approvedByUserId: roleCheck.user.id,
    approvedByName: parsed.data.clinicianName,
  });
  await logAccess(roleCheck.user.id, "ruleset_approve", "ruleset", meta.id);

  return NextResponse.json({ ok: true });
}
