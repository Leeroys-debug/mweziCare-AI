import { NextResponse } from "next/server";
import { createDraftRuleset, listRulesetVersions } from "@mwezicare/db";
import { ruleSchema } from "@mwezicare/rules-engine";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const STAFF_READ_ROLES = [
  "clinician",
  "programme_admin",
  "system_admin",
] as const;

/** All ruleset versions, newest first. */
export async function GET() {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const versions = await listRulesetVersions(db);
  return NextResponse.json({ versions });
}

const createDraftSchema = z.object({ rules: z.array(ruleSchema).min(1) });

/** Creates a new draft ruleset version (clinician only) from a clean slate or a copied/edited rule set. */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = createDraftSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid ruleset", parsed.error.message);

  const created = await createDraftRuleset(db, parsed.data.rules);
  await logAccess(
    roleCheck.user.id,
    "ruleset_create_draft",
    "ruleset",
    created.id,
  );

  return NextResponse.json({ ruleset: created }, { status: 201 });
}
