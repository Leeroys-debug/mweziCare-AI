"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@mwezicare/ui";

export function StarterQuestions({
  onSelect,
}: {
  onSelect: (question: string) => void;
}) {
  const t = useTranslations("Assistant");
  const questions = [
    t("starterQuestions.q1"),
    t("starterQuestions.q2"),
    t("starterQuestions.q3"),
    t("starterQuestions.q4"),
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {t("starterQuestionsTitle")}
      </span>
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <Chip
            key={question}
            selected={false}
            onClick={() => onSelect(question)}
          >
            {question}
          </Chip>
        ))}
      </div>
    </div>
  );
}
