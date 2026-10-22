"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SummaryData } from "@mwezicare/triage";
import type { SummaryPdfLabels } from "@/lib/summary-pdf";

export interface SummaryViewProps {
  data: SummaryData;
  labels: SummaryPdfLabels;
  displayLabel?: string;
  ageBand: string;
  locale: string;
}

/**
 * Read-only web rendering of a clinician summary — same SummaryData shape
 * and label set as the PDF (apps/web/lib/summary-pdf.tsx), reused by both
 * the public /s/[token] route and the user's own preview (task 24), so the
 * two never drift. Unlike the PDF (react-pdf's own SVG primitives), this
 * can use Recharts directly since it's real DOM.
 */
export function SummaryView({
  data,
  labels,
  displayLabel,
  ageBand,
  locale,
}: SummaryViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">{labels.title}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {displayLabel || labels.displayLabelFallback} · {labels.ageBandLabel}:{" "}
          {ageBand} · {labels.dateRangeLabel}: {data.from} – {data.to}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{labels.cyclesTitle}</h2>
        {data.cycles.length === 0 ? (
          <p className="text-sm text-neutral-500">{labels.noDataLabel}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th className="py-1">{labels.cycleStartColumn}</th>
                <th className="py-1">{labels.periodLengthColumn}</th>
                <th className="py-1">{labels.cycleLengthColumn}</th>
              </tr>
            </thead>
            <tbody>
              {data.cycles.map((cycle) => (
                <tr
                  key={cycle.startDate}
                  className="border-b border-neutral-100 dark:border-neutral-800"
                >
                  <td className="py-1">{cycle.startDate}</td>
                  <td className="py-1">
                    {cycle.periodLengthDays} {labels.daysUnit}
                  </td>
                  <td className="py-1">
                    {cycle.cycleLengthDays != null
                      ? `${cycle.cycleLengthDays} ${labels.daysUnit}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{labels.painChartTitle}</h2>
        {data.painChart.length === 0 ? (
          <p className="text-sm text-neutral-500">{labels.noDataLabel}</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.painChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cycleStartDate" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="maxPainScore"
                name={labels.maxPainLegend}
                stroke="#be123c"
              />
              <Line
                type="monotone"
                dataKey="avgPainScore"
                name={labels.avgPainLegend}
                stroke="#f59e0b"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">
          {labels.symptomFrequencyTitle}
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {data.symptomFrequency.map((entry) => (
              <tr
                key={entry.symptom}
                className="border-b border-neutral-100 dark:border-neutral-800"
              >
                <td className="py-1">
                  {labels.symptomLabels[entry.symptom] ?? entry.symptom}
                </td>
                <td className="py-1 text-right">
                  {entry.days} {labels.daysUnit}
                </td>
              </tr>
            ))}
            <tr className="border-b border-neutral-100 dark:border-neutral-800">
              <td className="py-1">{labels.missedSchoolLabel}</td>
              <td className="py-1 text-right">{data.missedSchoolDays}</td>
            </tr>
            <tr>
              <td className="py-1">{labels.missedWorkLabel}</td>
              <td className="py-1 text-right">{data.missedWorkDays}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{labels.assessmentTitle}</h2>
        {data.assessment ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium">
              {labels.outcomeLabels[data.assessment.outcome]}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">
              {labels.rulesetVersionLabel}: {data.assessment.rulesetVersion}
            </p>
            <ul className="list-disc pl-5">
              {data.assessment.reasons.map((reason, i) => (
                <li key={i}>{reason[locale === "sw" ? "sw" : "en"]}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            {labels.assessmentUnavailable}
          </p>
        )}
      </section>

      <p className="text-xs italic text-neutral-500">{labels.footer}</p>
    </div>
  );
}
