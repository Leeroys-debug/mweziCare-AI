import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { hmacLookup, schema } from "@mwezicare/db";
import { phoneNumberSchema } from "@mwezicare/validation";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db, hmacKeyProvider } from "@/lib/server-db";

const lookupSchema = z.object({ phoneNumber: phoneNumberSchema });

/**
 * Looks up a user by phone-hash equality only (identity.users.phoneNumber
 * already stores the HMAC hash, never the raw number — see lib/auth.ts).
 * Returns only account/support fields: role, locale, verification status,
 * created date. Never health fields (symptom logs, assessments, chat,
 * profile) — "system admin ... cannot view health fields" (D2.5 spec).
 * Every lookup is logged, whether or not a match is found.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["system_admin"]);
  if (!roleCheck.ok) return roleCheck.response;

  const body = await request.json().catch(() => null);
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid phone number", parsed.error.message);

  const phoneHash = hmacLookup(parsed.data.phoneNumber, hmacKeyProvider);
  const [user] = await db
    .select({
      id: schema.users.id,
      role: schema.users.role,
      locale: schema.users.locale,
      phoneNumberVerified: schema.users.phoneNumberVerified,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.phoneNumber, phoneHash));

  await logAccess(roleCheck.user.id, "user_lookup", "user", user?.id);

  if (!user) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, user });
}
