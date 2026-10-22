import { NextResponse } from "next/server";
import {
  getRulesetMeta,
  loadRulesetByVersion,
  saveDraftRules,
} from "@mwezicare/db";
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

function parseVersion(raw: string): number | null {
  const version = Number(raw);
  return Number.isInteger(version) && version > 0 ? version : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string }> },
) {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const { version: versionParam } = await params;
  const version = parseVersion(versionParam);
  if (version === null) return problem(400, "Invalid version");

  const [ruleset, meta] = await Promise.all([
    loadRulesetByVersion(db, version),
    getRulesetMeta(db, version),
  ]);
  if (!ruleset || !meta) return problem(404, "Ruleset version not found");

  return NextResponse.json({ ruleset, meta });
}

const saveSchema = z.object({ rules: z.array(ruleSchema).min(1) });

/** Replaces a DRAFT ruleset's rules (clinician only) — rejected for a non-draft version. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ version: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { version: versionParam } = await params;
  const version = parseVersion(versionParam);
  if (version === null) return problem(400, "Invalid version");

  const body = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid ruleset", parsed.error.message);

  const meta = await getRulesetMeta(db, version);
  if (!meta) return problem(404, "Ruleset version not found");
  if (meta.status !== "draft") {
    return problem(
      409,
      "Only draft rulesets can be edited",
      `Version ${version} is ${meta.status}`,
    );
  }

  await saveDraftRules(db, meta.id, parsed.data.rules);
  await logAccess(roleCheck.user.id, "ruleset_save_draft", "ruleset", meta.id);

  return NextResponse.json({ ok: true });
}
