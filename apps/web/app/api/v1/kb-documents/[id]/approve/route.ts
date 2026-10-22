import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { assertSameOrigin } from "@/lib/csrf";
import { enqueueKbIngest } from "@/lib/job-queue";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const REVIEW_INTERVAL_DAYS = 180;

function defaultReviewDue(): string {
  const date = new Date();
  date.setDate(date.getDate() + REVIEW_INTERVAL_DAYS);
  return date.toISOString().slice(0, 10);
}

/**
 * Approves a draft article and enqueues kb.ingest to (re-)chunk/embed its
 * current body — "approving triggers re-ingestion via a pg-boss job"
 * (D2 knowledge-base spec). Sets a review_due 180 days out if none is set.
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
  const [existing] = await db
    .select()
    .from(schema.kbDocuments)
    .where(eq(schema.kbDocuments.id, id));
  if (!existing) return problem(404, "Article not found");

  await db
    .update(schema.kbDocuments)
    .set({
      status: "approved",
      reviewedBy: roleCheck.user.id,
      reviewDue: existing.reviewDue ?? defaultReviewDue(),
      updatedAt: new Date(),
    })
    .where(eq(schema.kbDocuments.id, id));

  await logAccess(roleCheck.user.id, "kb_document_approve", "kb_document", id);
  await enqueueKbIngest(id);

  return NextResponse.json({ ok: true });
}
