import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const ASSIGNABLE_ROLES = [
  "user",
  "clinician",
  "verifier",
  "programme_admin",
  "system_admin",
] as const;

const updateRoleSchema = z.object({ role: z.enum(ASSIGNABLE_ROLES) });

/**
 * Grants/revokes staff access (clinician/verifier/programme_admin/
 * system_admin) — the only way to do this short of a direct database
 * update, which is what this replaces (see apps/web's Users page).
 * system_admin-only, same scope as the lookup route this sits beside.
 * Blocks changing your own role, so a system_admin can't lock themselves
 * out from this screen — that still has to be a deliberate direct DB step.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["system_admin"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  if (id === roleCheck.user.id) {
    return problem(
      400,
      "Cannot change your own role from this screen",
      "Use a direct database update if you really need to change the account you're signed in as.",
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid role", parsed.error.message);

  const [updated] = await db
    .update(schema.users)
    .set({ role: parsed.data.role })
    .where(eq(schema.users.id, id))
    .returning({ id: schema.users.id, role: schema.users.role });

  if (!updated) return problem(404, "User not found");

  await logAccess(roleCheck.user.id, "user_role_update", "user", id);

  return NextResponse.json({ ok: true, user: updated });
}
