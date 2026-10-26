import { NextResponse } from "next/server";
import { schema } from "@mwezicare/db";
import { assessmentReviewSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/**
 * Records a clinician's adjudication of one assessment's escalation
 * appropriateness (health.assessment_reviews) — the "safety of urgent
 * escalations" pilot metric (UNICEF Femtech proposal §10). Append-only:
 * a second review for the same assessment adds a new row rather than
 * editing the first (apps/web/lib/case-samples.ts reads the latest one).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = assessmentReviewSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid review payload", parsed.error.message);

  const [review] = await db
    .insert(schema.assessmentReviews)
    .values({
      assessmentId: id,
      reviewedBy: roleCheck.user.id,
      verdict: parsed.data.verdict,
      note: parsed.data.note,
    })
    .returning();

  return NextResponse.json({ review });
}
