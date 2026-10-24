"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@mwezicare/ui";
import { Link } from "@/i18n/navigation";
import { OfflineBanner } from "@/components/offline-banner";

interface ChartPoint {
  cycleStartDate: string;
  maxPainScore: number;
  avgPainScore: number;
  impactDays: number;
}

interface CyclesResponse {
  cycles: unknown[];
  nextPeriodEstimate: { date: string; isEstimate: true } | null;
  chartData: ChartPoint[];
}

type TriageOutcome = "routine" | "assess_soon" | "urgent";

interface Assessment {
  id: string;
  outcome: TriageOutcome;
  reasons: { en: string; sw: string }[];
  createdAt: string;
}

interface AssessmentsResponse {
  available: boolean;
  assessment?: Assessment;
}

// Pain chart: 2-series categorical palette, validated with dataviz skill's
// validate_palette.js (CVD ΔE 68.8, passes). Amber's contrast vs. the white
// surface is below 3:1 (a WARN, not a fail) — mitigated by the Legend below
// plus the Tooltip, so the series are never color-only.
const MAX_PAIN_COLOR = "#b82c5e";
const AVG_PAIN_COLOR = "#eda100";
// Impact-days chart: single series (magnitude), one brand hue.
const IMPACT_COLOR = "#dd3a73";

function daysUntil(dateIso: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const ms =
    new Date(`${dateIso}T00:00:00.000Z`).getTime() -
    new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function NextPeriodHero({
  estimate,
  t,
}: {
  estimate: { date: string; isEstimate: true } | null | undefined;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (!estimate) return null;
  const days = Math.max(0, daysUntil(estimate.date));

  return (
    <div className="-mx-4 -mt-4 flex flex-col items-center gap-1 bg-gradient-to-b from-brand-100 to-transparent px-4 pb-4 pt-6 text-center dark:from-brand-950">
      <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
        {t("nextPeriodEstimate")}
      </p>
      <p className="text-4xl font-bold text-brand-900 dark:text-brand-100">
        {days === 0 ? t("dueTodayLabel") : t("daysUntilLabel", { days })}
      </p>
      <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
        {estimate.date} ({t("estimateLabel")})
      </p>
    </div>
  );
}

const OUTCOME_TONE: Record<TriageOutcome, string> = {
  routine:
    "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950",
  assess_soon:
    "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950",
  urgent: "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950",
};

function AssessmentCard({
  data,
  locale,
  t,
}: {
  data: AssessmentsResponse | undefined;
  locale: "en" | "sw";
  t: (key: string) => string;
}) {
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
      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href="/care">{t("assessment.findCare")}</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/summary">{t("assessment.shareSummary")}</Link>
        </Button>
      </div>
    </div>
  );
}

export default function InsightsPage() {
  const t = useTranslations("Insights");
  const locale = useLocale() as "en" | "sw";

  const { data: cyclesData } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CyclesResponse> => {
      const response = await fetch("/api/v1/cycles");
      if (!response.ok) throw new Error("Failed to load cycles");
      return response.json() as Promise<CyclesResponse>;
    },
  });

  const { data: assessmentData } = useQuery({
    queryKey: ["assessments"],
    queryFn: async (): Promise<AssessmentsResponse> => {
      const response = await fetch("/api/v1/assessments");
      if (!response.ok) throw new Error("Failed to load assessment");
      return response.json() as Promise<AssessmentsResponse>;
    },
  });

  const chartData = cyclesData?.chartData ?? [];

  return (
    <div className="flex flex-col gap-6">
      <NextPeriodHero estimate={cyclesData?.nextPeriodEstimate} t={t} />

      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OfflineBanner />

      <AssessmentCard data={assessmentData} locale={locale} t={t} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("painChartTitle")}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noDataYet")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="cycleStartDate" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="maxPainScore"
                name={t("maxPain")}
                stroke={MAX_PAIN_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="avgPainScore"
                name={t("avgPain")}
                stroke={AVG_PAIN_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("impactChartTitle")}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noDataYet")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="cycleStartDate" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar
                dataKey="impactDays"
                name={t("impactDays")}
                fill={IMPACT_COLOR}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
