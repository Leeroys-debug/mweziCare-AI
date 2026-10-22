import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema, withUser } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id));

  const consents = await db
    .select()
    .from(schema.consents)
    .where(eq(schema.consents.userId, user.id));

  const health = await withUser(db, user.id, async (tx) => {
    const [cycles, symptomLogs, assessments, summaries] = await Promise.all([
      tx.select().from(schema.cycles).where(eq(schema.cycles.userId, user.id)),
      tx
        .select()
        .from(schema.symptomLogs)
        .where(eq(schema.symptomLogs.userId, user.id)),
      tx
        .select()
        .from(schema.assessments)
        .where(eq(schema.assessments.userId, user.id)),
      tx
        .select()
        .from(schema.summaries)
        .where(eq(schema.summaries.userId, user.id)),
    ]);
    return { cycles, symptomLogs, assessments, summaries };
  });

  // A user downloading their own data isn't a staff access, so no
  // audit.access_log entry — that's reserved for staff reading user data.

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    consents,
    ...health,
  });
}
