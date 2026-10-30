"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { QUIZ_QUESTION_COUNT } from "@mwezicare/validation";
import { Link } from "@/i18n/navigation";

const QUESTION_KEYS = Array.from(
  { length: QUIZ_QUESTION_COUNT },
  (_, i) => `q${i + 1}`,
);

interface QuizResult {
  score: number;
  total: number;
  scoreBand: string;
}

export default function QuizPage() {
  const t = useTranslations("Quiz");
  const searchParams = useSearchParams();
  const promptKind =
    searchParams.get("kind") === "day30" ? "day30" : "onboarding";

  const [answers, setAnswers] = useState<(number | null)[]>(
    Array.from({ length: QUIZ_QUESTION_COUNT }, () => null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

  const allAnswered = answers.every((a) => a !== null);

  async function handleSubmit() {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptKind, answers }),
      });
      if (response.status === 409) {
        setError(t("alreadyTaken"));
        return;
      }
      if (!response.ok) {
        setError(t("error"));
        return;
      }
      setResult((await response.json()) as QuizResult);
    } catch {
      setError(t("error"));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("resultTitle")}</h1>
        <p className="text-base">
          {t("resultBody", { score: result.score, total: result.total })}
        </p>
        <Button asChild size="lg">
          <Link href="/symptoms">{t("continue")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("intro")}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {QUESTION_KEYS.map((key, questionIndex) => {
          const options = t.raw(`questions.${key}.options`) as string[];
          return (
            <fieldset key={key} className="flex flex-col gap-2">
              <legend className="text-base font-medium">
                {t(`questions.${key}.text`)}
              </legend>
              {options.map((option, optionIndex) => (
                <label
                  key={optionIndex}
                  className="flex min-h-[44px] items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700"
                >
                  <input
                    type="radio"
                    name={key}
                    checked={answers[questionIndex] === optionIndex}
                    onChange={() =>
                      setAnswers((prev) =>
                        prev.map((a, i) =>
                          i === questionIndex ? optionIndex : a,
                        ),
                      )
                    }
                    className="h-5 w-5"
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!allAnswered || submitting}
          size="lg"
        >
          {submitting ? t("submitting") : t("submit")}
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/symptoms">{t("skip")}</Link>
        </Button>
      </div>
    </div>
  );
}
