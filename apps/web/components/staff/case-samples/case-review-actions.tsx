"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Verdict = "appropriate" | "inappropriate" | "uncertain";

const VERDICTS: Verdict[] = ["appropriate", "inappropriate", "uncertain"];

export function CaseReviewActions({
  assessmentId,
  initialVerdict,
}: {
  assessmentId: string;
  initialVerdict: Verdict | null;
}) {
  const t = useTranslations("StaffCaseSamples");
  const [verdict, setVerdict] = useState(initialVerdict);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function submit(next: Verdict) {
    setState("saving");
    try {
      const response = await fetch(
        `/api/v1/case-samples/${assessmentId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verdict: next }),
        },
      );
      if (!response.ok) {
        setState("error");
        return;
      }
      setVerdict(next);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {verdict ? (
        <span className="text-xs font-medium">
          {t(`verdictLabel.${verdict}`)}
        </span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {VERDICTS.map((option) => (
            <button
              key={option}
              type="button"
              disabled={state === "saving"}
              onClick={() => submit(option)}
              className="min-h-[28px] rounded border border-neutral-300 px-2 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {t(`verdictLabel.${option}`)}
            </button>
          ))}
        </div>
      )}
      {state === "error" && (
        <span className="text-xs text-red-600">{t("reviewError")}</span>
      )}
    </div>
  );
}
