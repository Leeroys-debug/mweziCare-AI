import { createTranslator } from "use-intl/core";
import type { SummaryPdfLabels } from "./summary-pdf";
import type { MyDataPdfLabels } from "./my-data-pdf";

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
    familyHistoryLabel: t("familyHistoryLabel"),
    familyHistoryYes: t("familyHistoryYes"),
    familyHistoryNo: t("familyHistoryNo"),
    familyHistoryNotAnswered: t("familyHistoryNotAnswered"),
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
      bloodInUrine: t("symptom.bloodInUrine"),
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

/**
 * Resolves the "my data" PDF's labels — mostly its own MyDataPdf namespace,
 * plus the per-symptom/impact/bleeding-level names already translated for
 * the Track tab and the outcome wording already reviewed for the clinician
 * summary, so neither is duplicated a third time.
 */
export async function loadMyDataPdfLabels(
  locale: string,
): Promise<MyDataPdfLabels> {
  const messages = (await import(`../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "MyDataPdf" });
  const track = createTranslator({ locale, messages, namespace: "Track" });
  const outcome = createTranslator({
    locale,
    messages,
    namespace: "Summary.pdf.outcome",
  });

  return {
    title: t("title"),
    generatedAtLabel: t("generatedAtLabel"),
    profileTitle: t("profileTitle"),
    ageBandLabel: t("ageBandLabel"),
    countyLabel: t("countyLabel"),
    familyHistoryLabel: t("familyHistoryLabel"),
    familyHistoryYes: t("familyHistoryYes"),
    familyHistoryNo: t("familyHistoryNo"),
    familyHistoryNotAnswered: t("familyHistoryNotAnswered"),
    noProfileLabel: t("noProfileLabel"),
    consentsTitle: t("consentsTitle"),
    consentColumn: t("consentColumn"),
    statusColumn: t("statusColumn"),
    consentGranted: t("consentGranted"),
    consentNotGranted: t("consentNotGranted"),
    cyclesTitle: t("cyclesTitle"),
    cycleStartColumn: t("cycleStartColumn"),
    periodLengthColumn: t("periodLengthColumn"),
    cycleLengthColumn: t("cycleLengthColumn"),
    daysUnit: t("daysUnit"),
    logsTitle: t("logsTitle"),
    dateColumn: t("dateColumn"),
    periodDayColumn: t("periodDayColumn"),
    bleedingColumn: t("bleedingColumn"),
    painColumn: t("painColumn"),
    symptomsColumn: t("symptomsColumn"),
    impactColumn: t("impactColumn"),
    notesColumn: t("notesColumn"),
    yes: t("yes"),
    no: t("no"),
    symptomLabels: {
      fatigue: track("symptom.fatigue"),
      nausea: track("symptom.nausea"),
      painWithBowelMovements: track("symptom.painWithBowelMovements"),
      painWithUrination: track("symptom.painWithUrination"),
      bloodInUrine: track("symptom.bloodInUrine"),
      painWithSex: track("symptom.painWithSex"),
    },
    impactLabels: {
      missedSchool: track("impact.missedSchool"),
      missedWork: track("impact.missedWork"),
      sleepDisrupted: track("impact.sleepDisrupted"),
      activitiesLimited: track("impact.activitiesLimited"),
    },
    bleedingLabels: {
      none: track("bleedingLevel.none"),
      spotting: track("bleedingLevel.spotting"),
      light: track("bleedingLevel.light"),
      medium: track("bleedingLevel.medium"),
      heavy: track("bleedingLevel.heavy"),
      very_heavy: track("bleedingLevel.very_heavy"),
    },
    assessmentsTitle: t("assessmentsTitle"),
    assessmentDateColumn: t("assessmentDateColumn"),
    outcomeColumn: t("outcomeColumn"),
    rulesetVersionColumn: t("rulesetVersionColumn"),
    reasonsColumn: t("reasonsColumn"),
    outcomeLabels: {
      routine: outcome("routine"),
      assess_soon: outcome("assess_soon"),
      urgent: outcome("urgent"),
    },
    summariesTitle: t("summariesTitle"),
    summaryCreatedColumn: t("summaryCreatedColumn"),
    summaryPeriodColumn: t("summaryPeriodColumn"),
    summaryStatusColumn: t("summaryStatusColumn"),
    summaryStatusActive: t("summaryStatusActive"),
    summaryStatusExpired: t("summaryStatusExpired"),
    summaryStatusRevoked: t("summaryStatusRevoked"),
    noDataLabel: t("noDataLabel"),
    footer: t("footer"),
  };
}
