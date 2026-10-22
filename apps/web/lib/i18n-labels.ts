import { createTranslator } from "use-intl/core";
import type { SummaryPdfLabels } from "./summary-pdf";

/**
 * General-purpose translator for server contexts outside next-intl's React
 * tree — e.g. /s/[token], which sits outside the [locale] segment entirely
 * (proxy.ts's matcher excludes `s/`), so there's no NextIntlClientProvider
 * to read from.
 */
export async function loadTranslator(locale: string, namespace?: string) {
  const messages = (await import(`../messages/${locale}.json`)).default;
  return createTranslator({ locale, messages, namespace });
}

/**
 * Resolves PDF label strings for a given locale outside of React — the PDF
 * renderer's component tree isn't wrapped in NextIntlClientProvider, so the
 * `useTranslations` hook isn't available. Uses the same message JSON files
 * next-intl reads from (apps/web/messages/*.json).
 */
export async function loadSummaryPdfLabels(
  locale: string,
): Promise<SummaryPdfLabels> {
  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "Summary.pdf" });

  return {
    title: t("title"),
    dateRangeLabel: t("dateRangeLabel"),
    displayLabelFallback: t("displayLabelFallback"),
    ageBandLabel: t("ageBandLabel"),
    cyclesTitle: t("cyclesTitle"),
    cycleStartColumn: t("cycleStartColumn"),
    periodLengthColumn: t("periodLengthColumn"),
    cycleLengthColumn: t("cycleLengthColumn"),
    daysUnit: t("daysUnit"),
    painChartTitle: t("painChartTitle"),
    maxPainLegend: t("maxPainLegend"),
    avgPainLegend: t("avgPainLegend"),
    symptomFrequencyTitle: t("symptomFrequencyTitle"),
    symptomLabels: {
      fatigue: t("symptom.fatigue"),
      nausea: t("symptom.nausea"),
      painWithBowelMovements: t("symptom.painWithBowelMovements"),
      painWithUrination: t("symptom.painWithUrination"),
      painWithSex: t("symptom.painWithSex"),
    },
    missedSchoolLabel: t("missedSchoolLabel"),
    missedWorkLabel: t("missedWorkLabel"),
    assessmentTitle: t("assessmentTitle"),
    assessmentUnavailable: t("assessmentUnavailable"),
    outcomeLabels: {
      routine: t("outcome.routine"),
      assess_soon: t("outcome.assess_soon"),
      urgent: t("outcome.urgent"),
    },
    rulesetVersionLabel: t("rulesetVersionLabel"),
    noDataLabel: t("noDataLabel"),
    footer: t("footer"),
  };
}
