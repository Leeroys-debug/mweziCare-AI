import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

const purposeSchema = z.enum(["tracking", "location", "research", "sharing"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ purpose: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const parsed = purposeSchema.safeParse((await params).purpose);
  if (!parsed.success) return problem(400, "Unknown consent purpose");

  await db.insert(schema.consents).values({
    userId: user.id,
    purpose: parsed.data,
    version: 1,
    grantedAt: new Date(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ purpose: string }> },
) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const parsed = purposeSchema.safeParse((await params).purpose);
  if (!parsed.success) return problem(400, "Unknown consent purpose");

  if (parsed.data === "tracking") {
    return problem(
      400,
      "Tracking consent can't be withdrawn here",
      "Delete the account instead (DELETE /api/v1/me) to stop tracking entirely.",
    );
  }

  const [active] = await db
    .select()
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, user.id),
        eq(schema.consents.purpose, parsed.data),
        isNull(schema.consents.withdrawnAt),
      ),
    )
    .orderBy(desc(schema.consents.version))
    .limit(1);

  if (active) {
    await db
      .update(schema.consents)
      .set({ withdrawnAt: new Date() })
      .where(eq(schema.consents.id, active.id));
  }

  return NextResponse.json({ ok: true });
}
