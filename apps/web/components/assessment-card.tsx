"use client";

import { Button, Skeleton } from "@mwezicare/ui";
import { Link } from "@/i18n/navigation";

export type TriageOutcome = "routine" | "assess_soon" | "urgent";

export interface Assessment {
  id: string;
  outcome: TriageOutcome;
  reasons: { en: string; sw: string }[];
  createdAt: string;
}

export interface AssessmentsResponse {
  available: boolean;
  assessment?: Assessment;
}

const OUTCOME_TONE: Record<TriageOutcome, string> = {
  routine:
    "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
  assess_soon:
    "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
  urgent: "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950",
};

/**
 * Shows the user's latest rules-engine assessment (packages/rules-engine —
 * CLAUDE.md: urgency is only ever decided there, never by UI copy or an
 * ad-hoc client-side guess) with friendly, outcome-specific framing: a
 * reassuring note for routine/normal-period-pattern results, and a warm but
 * clear nudge toward care for assess_soon/urgent ones. Shared between the
 * Insights page and the Symptoms tab (right after saving a log) so the
 * wording and tone never drift between the two places it appears.
 */
export function AssessmentCard({
  data,
  isLoading,
  locale,
  t,
}: {
  data: AssessmentsResponse | undefined;
  isLoading: boolean;
  locale: "en" | "sw";
  t: (key: string) => string;
}) {
  if (isLoading) return <Skeleton className="h-20" />;
  if (!data) return null;

  if (!data.available || !data.assessment) {
    return (
      <div className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        {t("assessment.unavailable")}
      </div>
    );
  }

  const { outcome, reasons } = data.assessment;

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${OUTCOME_TONE[outcome]}`}
    >
      <p className="font-semibold">{t(`assessment.nextStep.${outcome}`)}</p>
      {reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {reasons.map((reason, i) => (
            <li key={i}>{reason[locale]}</li>
          ))}
        </ul>
      )}
      <p className="text-xs italic text-neutral-600 dark:text-neutral-400">
        {t("assessment.uncertaintyNote")}
      </p>
      {outcome !== "routine" && (
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/care">{t("assessment.findCare")}</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/summary">{t("assessment.shareSummary")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
