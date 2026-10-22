import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { logAccess, requireApiRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/** Reverts an approved article to draft — e.g. a review finds it needs more work. */
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
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(schema.kbDocuments.id, id));

  await logAccess(
    roleCheck.user.id,
    "kb_document_send_back",
    "kb_document",
    id,
  );

  return NextResponse.json({ ok: true });
}
