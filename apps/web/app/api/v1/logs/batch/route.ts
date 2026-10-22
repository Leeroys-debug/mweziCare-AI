import { NextResponse } from "next/server";
import { track, upsertSymptomLog, withUser } from "@mwezicare/db";
import { logsBatchSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import {
  analyticsKeyProvider,
  db,
  encryptionKeyProvider,
} from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * Syncs a batch of offline-queued daily logs. Upserts each by
 * (user_id, log_date) with last-write-wins on the client's updatedAt —
 * see packages/db/src/symptom-logs.ts. Idempotent: retrying the same
 * client_id for a date that's already stored is a no-op, so offline retries
 * never create duplicate rows.
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = logsBatchSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Invalid batch payload", parsed.error.message);
  }

  const results = await withUser(db, user.id, async (tx) => {
    const out = [];
    for (const log of parsed.data.logs) {
      out.push(await upsertSymptomLog(tx, user.id, log, encryptionKeyProvider));
    }
    return out;
  });

  // Only "created"/"updated" — "unchanged" means an idempotent retry of an
  // already-synced log (see packages/db/src/symptom-logs.ts), which must
  // not count as a second log_saved event.
  for (const result of results) {
    if (result.status === "unchanged") continue;
    await track(db, {
      userId: user.id,
      eventType: "log_saved",
      props: {},
      analyticsKeyProvider,
    });
  }

  return NextResponse.json({ results });
}
