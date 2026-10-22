import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { schema } from "@mwezicare/db";
import { auth } from "./auth";
import { problem } from "./problem-details";
import { db } from "./server-db";

export type Role =
  "user" | "clinician" | "verifier" | "programme_admin" | "system_admin";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/**
 * Role-checked inside the handler, not just middleware (CLAUDE.md) — call
 * this at the top of every (staff) page/layout and every staff API route,
 * in addition to proxy.ts's coarse redirect.
 */
export async function requireRole(allowedRoles: Role[]) {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;
  if (!user || !role || !allowedRoles.includes(role as Role)) {
    redirect("/");
  }
  await logAccess(user.id, "staff_access", "staff_area");
  return user;
}

/**
 * Role check for API route handlers (not Server Components) — returns a
 * 403 problem-details response instead of redirecting, since `redirect()`
 * isn't the right shape of error for a JSON endpoint. Every staff route
 * still calls this inside the handler itself, not just the (staff) layout
 * (CLAUDE.md).
 */
export async function requireApiRole(
  allowedRoles: Role[],
): Promise<
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }
  | { ok: false; response: Response }
> {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;
  if (!user || !role || !allowedRoles.includes(role as Role)) {
    return {
      ok: false,
      response: problem(
        403,
        "Forbidden",
        "Your role doesn't permit this action",
      ),
    };
  }
  return { ok: true, user };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  return user;
}

/** Append-only — see packages/db/drizzle/0001_roles_rls_views.sql. */
export async function logAccess(
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
) {
  await db
    .insert(schema.accessLog)
    .values({ actorId, action, entity, entityId });
}
