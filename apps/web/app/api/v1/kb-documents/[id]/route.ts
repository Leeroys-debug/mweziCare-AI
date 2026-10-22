import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { enqueueKbIngest } from "@/lib/job-queue";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

const STAFF_READ_ROLES = [
  "clinician",
  "programme_admin",
  "system_admin",
] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const roleCheck = await requireApiRole([...STAFF_READ_ROLES]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const [document] = await db
    .select()
    .from(schema.kbDocuments)
    .where(eq(schema.kbDocuments.id, id));
  if (!document) return problem(404, "Article not found");

  return NextResponse.json({ document });
}

const updateSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  reviewDue: z.string().date().nullable(),
});

/**
 * Edits an article's title/body/review_due. If the article is already
 * approved, re-enqueues kb.ingest so the live chunks reflect the edit
 * immediately — approving a still-draft article (below) does the same.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const roleCheck = await requireApiRole(["clinician"]);
  if (!roleCheck.ok) return roleCheck.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid article", parsed.error.message);

  const [existing] = await db
    .select()
    .from(schema.kbDocuments)
    .where(eq(schema.kbDocuments.id, id));
  if (!existing) return problem(404, "Article not found");

  await db
    .update(schema.kbDocuments)
    .set({
      title: parsed.data.title,
      body: parsed.data.body,
      reviewDue: parsed.data.reviewDue,
      updatedAt: new Date(),
    })
    .where(eq(schema.kbDocuments.id, id));

  await logAccess(roleCheck.user.id, "kb_document_edit", "kb_document", id);

  if (existing.status === "approved") {
    await enqueueKbIngest(id);
  }

  return NextResponse.json({ ok: true });
}
