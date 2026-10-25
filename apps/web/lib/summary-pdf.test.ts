import { describe, expect, it } from "vitest";
import type { SummaryData } from "@mwezicare/triage";
import {
  renderSummaryPdf,
  type SummaryPdfLabels,
  type SummaryPdfMeta,
} from "./summary-pdf";

const labels: SummaryPdfLabels = {
  title: "Clinician summary",
  dateRangeLabel: "Date range",
  displayLabelFallback: "MweziCare user",
  ageBandLabel: "Age band",
  familyHistoryLabel: "Family history of endometriosis",
  familyHistoryYes: "Yes",
  familyHistoryNo: "No",
  familyHistoryNotAnswered: "Not answered",
  cyclesTitle: "Cycles",
  cycleStartColumn: "Start",
  periodLengthColumn: "Period length",
  cycleLengthColumn: "Cycle length",
  daysUnit: "days",
  painChartTitle: "Pain per cycle",
  maxPainLegend: "Highest pain",
  avgPainLegend: "Average pain",
  symptomFrequencyTitle: "Symptom frequency",
  symptomLabels: {
    fatigue: "Fatigue",
    nausea: "Nausea",
    painWithBowelMovements: "Pain with bowel movements",
    painWithUrination: "Pain with urination",
    painWithSex: "Pain with sex",
  },
  missedSchoolLabel: "Missed school",
  missedWorkLabel: "Missed work",
  assessmentTitle: "Latest assessment",
  assessmentUnavailable: "Not available yet",
  outcomeLabels: {
    routine: "Routine",
    assess_soon: "Assess soon",
    urgent: "Urgent",
  },
  rulesetVersionLabel: "Ruleset version",
  noDataLabel: "No data for this range",
  footer: "Generated from self-reported app data. Not a diagnosis.",
};

function syntheticData(): SummaryData {
  return {
    from: "2026-01-01",
    to: "2026-03-31",
    cycles: [
      { startDate: "2026-01-01", periodLengthDays: 4, cycleLengthDays: 28 },
      { startDate: "2026-01-29", periodLengthDays: 5, cycleLengthDays: 30 },
      { startDate: "2026-02-28", periodLengthDays: 3, cycleLengthDays: null },
    ],
    painChart: [
      {
        cycleStartDate: "2026-01-01",
        maxPainScore: 6,
        avgPainScore: 4,
        impactDays: 1,
      },
      {
        cycleStartDate: "2026-01-29",
        maxPainScore: 8,
        avgPainScore: 5.5,
        impactDays: 2,
      },
      {
        cycleStartDate: "2026-02-28",
        maxPainScore: 3,
        avgPainScore: 2,
        impactDays: 0,
      },
    ],
    symptomFrequency: [
      { symptom: "fatigue", days: 7 },
      { symptom: "nausea", days: 2 },
      { symptom: "painWithBowelMovements", days: 1 },
      { symptom: "painWithUrination", days: 0 },
      { symptom: "painWithSex", days: 0 },
    ],
    missedSchoolDays: 3,
    missedWorkDays: 0,
    assessment: {
      outcome: "assess_soon",
      reasons: [{ en: "Test reason", sw: "Sababu ya mtihani" }],
      rulesetVersion: 2,
    },
  };
}

describe("renderSummaryPdf", () => {
  it("produces a valid PDF buffer (%PDF- magic bytes)", async () => {
    const meta: SummaryPdfMeta = {
      displayLabel: "A.N.",
      ageBand: "21-24",
      familyHistoryEndometriosis: true,
      locale: "en",
      labels,
    };
    const buffer = await renderSummaryPdf(syntheticData(), meta);

    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("matches the expected synthetic SummaryData shape (data snapshot, not PDF bytes — see plan decision 7)", () => {
    expect(syntheticData()).toMatchSnapshot();
  });

  it("renders without an assessment or any cycles (empty-state paths)", async () => {
    const emptyData: SummaryData = {
      from: "2026-01-01",
      to: "2026-01-31",
      cycles: [],
      painChart: [],
      symptomFrequency: [],
      missedSchoolDays: 0,
      missedWorkDays: 0,
      assessment: null,
    };
    const meta: SummaryPdfMeta = {
      ageBand: "18-20",
      familyHistoryEndometriosis: null,
      locale: "sw",
      labels,
    };
    const buffer = await renderSummaryPdf(emptyData, meta);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});
