import { NextResponse } from "next/server";
import { setMessageFeedback } from "@mwezicare/assistant";
import { chatFeedbackSchema } from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { problem } from "@/lib/problem-details";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";

/** Thumbs up/down on a chat message — merged into its safetyFlags jsonb. */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = chatFeedbackSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid feedback", parsed.error.message);

  await setMessageFeedback(
    db,
    user.id,
    parsed.data.messageId,
    parsed.data.feedback,
  );
  return NextResponse.json({ ok: true });
}
