import { z } from "zod";

/** Question copy lives in messages/{en,sw}.json ("Quiz.questions") — this is just the scoring key. */
export const QUIZ_QUESTION_COUNT = 5;
export const QUIZ_CORRECT_ANSWERS = [0, 1, 0, 1, 1] as const;

export const quizPromptKindSchema = z.enum(["onboarding", "day30"]);

export const quizSubmitSchema = z.object({
  promptKind: quizPromptKindSchema,
  answers: z.array(z.number().int().min(0).max(3)).length(QUIZ_QUESTION_COUNT),
});
export type QuizSubmitInput = z.infer<typeof quizSubmitSchema>;

export type QuizScoreBand = "0-2" | "3-4" | "5";

export function scoreQuiz(answers: number[]): number {
  return answers.filter((answer, i) => answer === QUIZ_CORRECT_ANSWERS[i])
    .length;
}

export function scoreBandFor(score: number): QuizScoreBand {
  if (score >= QUIZ_QUESTION_COUNT) return "5";
  if (score >= 3) return "3-4";
  return "0-2";
}
