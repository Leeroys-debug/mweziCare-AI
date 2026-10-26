"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { DashboardViewName } from "@mwezicare/db";
import {
  averageForLatestWeek,
  groupedForLatestWeek,
  sumByWeek,
  totalForLatestWeek,
  type DashboardRow,
} from "./aggregate";
import { KpiTile } from "./kpi-tile";

// Recharts is only needed once the dashboard actually mounts, so it's kept
// out of any other page's bundle and loaded lazily even within this one.
const ActiveUsersTrendChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.ActiveUsersTrendChart),
  { ssr: false },
);
const OutcomeDistributionChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.OutcomeDistributionChart),
  { ssr: false },
);
const LanguageSplitChart = dynamic(
  () => import("./dashboard-charts").then((m) => m.LanguageSplitChart),
  { ssr: false },
);

const AGE_BANDS = ["13-15", "16-17", "18-20", "21-24", "25+"] as const;
const VIEWS: DashboardViewName[] = [
  "weekly_active_users",
  "logs_per_active_user",
  "outcome_distribution",
  "referrals_per_outcome",
  "knowledge_score_change",
  "language_split",
  "referral_follow_up_rate",
  "time_to_care_seeking",
];

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function DashboardView() {
  const t = useTranslations("StaffDashboard");

  const [from, setFrom] = useState(() => isoDaysAgo(84));
  const [to, setTo] = useState(() => isoDaysAgo(0));
  const [county, setCounty] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [data, setData] = useState<
    Partial<Record<DashboardViewName, DashboardRow[]>>
  >({});

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (county) params.set("county", county);
    if (ageBand) params.set("ageBand", ageBand);
    return params.toString();
  }, [from, to, county, ageBand]);

  useEffect(() => {
    (async () => {
      const results = await Promise.all(
        VIEWS.map(async (view) => {
          const response = await fetch(
            `/api/v1/dashboard?view=${view}&${queryString}`,
          );
          if (!response.ok) return [view, []] as const;
          const body = (await response.json()) as { rows: DashboardRow[] };
          return [view, body.rows] as const;
        }),
      );
      setData(
        Object.fromEntries(results) as Partial<
          Record<DashboardViewName, DashboardRow[]>
        >,
      );
    })();
  }, [queryString]);

  const activeUsersRows = data.weekly_active_users ?? [];
  const logsPerUserRows = data.logs_per_active_user ?? [];
  const outcomeRows = data.outcome_distribution ?? [];
  const referralRows = data.referrals_per_outcome ?? [];
  const languageRows = data.language_split ?? [];
  const timeToCareRows = data.time_to_care_seeking ?? [];

  const activeUsersTrend = sumByWeek(activeUsersRows, "active_users");
  const outcomeSnapshot = groupedForLatestWeek(
    outcomeRows,
    "outcome",
    "assessment_count",
  );
  const languageSnapshot = groupedForLatestWeek(
    languageRows,
    "locale",
    "distinct_users",
  );

  const latestActiveUsers = totalForLatestWeek(activeUsersRows, "active_users");
  const latestLogsPerUser = averageForLatestWeek(
    logsPerUserRows,
    "logs_per_active_user",
  );
  const latestReferrals = totalForLatestWeek(referralRows, "referral_count");
  const latestDaysToCareSeeking = averageForLatestWeek(
    timeToCareRows,
    "avg_days_to_care_seeking",
  );
  const urgentCount =
    outcomeSnapshot.find((o) => o.group === "urgent")?.value ?? 0;
  const totalOutcomes = outcomeSnapshot.reduce((sum, o) => sum + o.value, 0);
  const urgentShare =
    totalOutcomes > 0 ? Math.round((urgentCount / totalOutcomes) * 100) : 0;

  function exportUrl(view: DashboardViewName): string {
    return `/api/v1/dashboard/export?view=${view}&${queryString}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("filters.from")}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("filters.to")}
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("filters.county")}
          <input
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder={t("filters.countyAll")}
            className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("filters.ageBand")}
          <select
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">{t("filters.ageBandAll")}</option>
            {AGE_BANDS.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiTile
          label={t("kpis.activeUsers")}
          value={String(latestActiveUsers)}
        />
        <KpiTile
          label={t("kpis.logsPerActiveUser")}
          value={latestLogsPerUser.toFixed(1)}
        />
        <KpiTile label={t("kpis.urgentShare")} value={`${urgentShare}%`} />
        <KpiTile label={t("kpis.referrals")} value={String(latestReferrals)} />
        <KpiTile
          label={t("kpis.daysToCareSeeking")}
          value={latestDaysToCareSeeking.toFixed(1)}
        />
      </div>

      <ActiveUsersTrendChart data={activeUsersTrend} />
      <OutcomeDistributionChart data={outcomeSnapshot} />
      <LanguageSplitChart data={languageSnapshot} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t("exportCsv")}</h2>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((view) => (
            <a
              key={view}
              href={exportUrl(view)}
              className="min-h-[36px] rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {view} — {t("exportCsv")}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
