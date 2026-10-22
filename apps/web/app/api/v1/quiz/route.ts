import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { schema, track, withUser } from "@mwezicare/db";
import {
  QUIZ_QUESTION_COUNT,
  quizSubmitSchema,
  scoreBandFor,
  scoreQuiz,
} from "@mwezicare/validation";
import { assertSameOrigin } from "@/lib/csrf";
import { getCurrentUser } from "@/lib/rbac";
import { analyticsKeyProvider, db } from "@/lib/server-db";
import { problem } from "@/lib/problem-details";

/**
 * Scores and records one quiz attempt (onboarding or day30 — one of each
 * per user, enforced by health.quiz_attempts' unique index). For a day30
 * attempt, looks up that SAME user's own onboarding score to derive a
 * score-change band — the only thing that ever leaves this route for
 * analytics is the band, never the raw scores (packages/db's track()).
 */
export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  const user = await getCurrentUser();
  if (!user) return problem(401, "Sign in required");

  const body = await request.json().catch(() => null);
  const parsed = quizSubmitSchema.safeParse(body);
  if (!parsed.success)
    return problem(400, "Invalid quiz submission", parsed.error.message);

  const existing = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.quizAttempts.id })
      .from(schema.quizAttempts)
      .where(
        and(
          eq(schema.quizAttempts.userId, user.id),
          eq(schema.quizAttempts.promptKind, parsed.data.promptKind),
        ),
      ),
  );
  if (existing.length > 0) {
    return problem(
      409,
      "Quiz already taken",
      `You've already submitted the ${parsed.data.promptKind} quiz`,
    );
  }

  const score = scoreQuiz(parsed.data.answers);
  const scoreBand = scoreBandFor(score);

  let scoreChangeBand: "improved" | "same" | "declined" | undefined;
  if (parsed.data.promptKind === "day30") {
    const [onboardingAttempt] = await withUser(db, user.id, (tx) =>
      tx
        .select({ score: schema.quizAttempts.score })
        .from(schema.quizAttempts)
        .where(
          and(
            eq(schema.quizAttempts.userId, user.id),
            eq(schema.quizAttempts.promptKind, "onboarding"),
          ),
        ),
    );
    if (onboardingAttempt) {
      scoreChangeBand =
        score > onboardingAttempt.score
          ? "improved"
          : score === onboardingAttempt.score
            ? "same"
            : "declined";
    }
  }

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.quizAttempts).values({
      userId: user.id,
      promptKind: parsed.data.promptKind,
      score,
      totalQuestions: QUIZ_QUESTION_COUNT,
    }),
  );

  await track(db, {
    userId: user.id,
    eventType: "knowledge_quiz_completed",
    props: { scoreBand, promptKind: parsed.data.promptKind, scoreChangeBand },
    analyticsKeyProvider,
  });

  return NextResponse.json({ score, total: QUIZ_QUESTION_COUNT, scoreBand });
}
