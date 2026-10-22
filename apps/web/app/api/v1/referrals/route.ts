import { NextResponse } from "next/server";
import { schema, track } from "@mwezicare/db";
import { referralSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/** Records "I contacted this facility" — see facilities.referrals. */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = referralSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid referral payload", parsed.error.message);

  const [referral] = await db
    .insert(schema.referrals)
    .values({
      userId: user.id,
      facilityId: parsed.data.facilityId,
      followUpConsent: parsed.data.followUpConsent ?? false,
    })
    .returning();

  await track(db, {
    userId: user.id,
    eventType: "referral_recorded",
    props: { outcome: parsed.data.outcome },
    analyticsKeyProvider,
  });

  return NextResponse.json({ referral });
}
