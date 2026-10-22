import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema, track } from "@mwezicare/db";
import { MINOR_AGE_BANDS, onboardingSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) {
    return problem(401, "Sign in required");
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid profile data", parsed.error.message);
  }
  const { ageBand, county, consents } = parsed.data;

  // [LEGAL REVIEW REQUIRED] No guardian-consent flow exists yet — block
  // onboarding outright for under-18 age bands rather than let tracking
  // start without it (CLAUDE.md).
  if (MINOR_AGE_BANDS.has(ageBand)) {
    return problem(
      403,
      "Guardian consent required",
      "Onboarding for under-18 age bands is paused until the guardian-consent flow is built.",
    );
  }

  await db
    .insert(schema.profiles)
    .values({ userId: user.id, ageBand, county, consentVersion: 1 })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { ageBand, county, updatedAt: new Date() },
    });

  const grantedPurposes = (
    Object.entries(consents) as [keyof typeof consents, boolean][]
  )
    .filter(([, granted]) => granted)
    .map(([purpose]) => purpose);

  if (grantedPurposes.length > 0) {
    await db
      .insert(schema.consents)
      .values(
        grantedPurposes.map((purpose) => ({
          userId: user.id,
          purpose,
          version: 1,
          grantedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  }

  await track(db, {
    userId: user.id,
    eventType: "signup_completed",
    props: {},
    analyticsKeyProvider,
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return problem(401, "Sign in required");
  }

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));

  return NextResponse.json({ profile: profile ?? null });
}
