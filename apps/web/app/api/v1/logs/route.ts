import { NextResponse } from "next/server";
import { listSymptomLogs, withUser } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { db, encryptionKeyProvider } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Logs in a date range, for the calendar view. `?from=YYYY-MM-DD&to=YYYY-MM-DD`, both inclusive. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return problem(
      400,
      "Invalid date range",
      "from and to query params must be YYYY-MM-DD",
    );
  }

  const logs = await withUser(db, user.id, (tx) =>
    listSymptomLogs(tx, user.id, { from, to }, encryptionKeyProvider),
  );

  return NextResponse.json({ logs });
}
