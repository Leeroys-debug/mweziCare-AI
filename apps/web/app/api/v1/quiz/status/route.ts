import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { schema, withUser } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

const DAY30_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether the day30 re-prompt banner should show on /track — 30+ days since signup, not yet taken. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const [userRow] = await db
    .select({ createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, user.id));

  const attempts = await withUser(db, user.id, (tx) =>
    tx
      .select({ promptKind: schema.quizAttempts.promptKind })
      .from(schema.quizAttempts)
      .where(eq(schema.quizAttempts.userId, user.id)),
  );
  const takenKinds = new Set(attempts.map((a) => a.promptKind));

  const accountAgeMs = userRow
    ? Date.now() - new Date(userRow.createdAt).getTime()
    : 0;
  const dueDay30 = accountAgeMs >= DAY30_MS && !takenKinds.has("day30");

  return NextResponse.json({ dueDay30 });
}
