import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { schema, withUser } from "@mwezicare/db";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/** Revokes the user's own summary share link — the public /s/[token] route 404s afterward. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const { id } = await params;
  const [updated] = await withUser(db, user.id, (tx) =>
    tx
      .update(schema.summaries)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(schema.summaries.id, id), eq(schema.summaries.userId, user.id)),
      )
      .returning(),
  );

  if (!updated) return problem(404, "Summary not found");
  return NextResponse.json({
    summary: { id: updated.id, revokedAt: updated.revokedAt },
  });
}
