import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { auth } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * Marks the account for deletion and signs the user out immediately — it
 * does NOT delete anything itself. The retention job
 * (worker/jobs/retention.ts) does the real purge ACCOUNT_PURGE_DAYS later
 * (F1 spec's 30-day grace window), via a single `DELETE FROM identity.users`
 * that cascades to every user-scoped table (identity.profiles/consents/
 * sessions/accounts, health.*, facilities.referrals — see
 * packages/db/src/schema's `ON DELETE CASCADE` FKs).
 */
export async function DELETE(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) {
    return problem(401, "Sign in required");
  }

  await db
    .update(schema.users)
    .set({ deletionRequestedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  await auth.api.signOut({ headers: request.headers }).catch(() => {});

  const response = NextResponse.json({ ok: true });
  response.cookies.set("better-auth.session_token", "", { maxAge: 0 });
  return response;
}
