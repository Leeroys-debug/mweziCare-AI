"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
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
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <OfflineBanner />

      {cyclesData?.nextPeriodEstimate && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("nextPeriodEstimate")} {cyclesData.nextPeriodEstimate.date}{" "}
          <span className="text-xs italic">({t("estimateLabel")})</span>
        </p>
      )}

      <AssessmentCard data={assessmentData} locale={locale} t={t} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("painChartTitle")}</h2>
        {chartData.length === 0 ? (
          <p className="text-sm text-neutral-500">{t("noDataYet")}</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cycleStartDate" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="maxPainScore"
                name={t("maxPain")}
                stroke="#be123c"
              />
              <Line
                type="monotone"
                dataKey="avgPainScore"
                name={t("avgPain")}
                stroke="#f59e0b"
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
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cycleStartDate" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="impactDays" name={t("impactDays")} fill="#0f766e" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
