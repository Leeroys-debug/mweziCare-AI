"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";
import type { GroupedPoint, WeeklyPoint } from "./aggregate";

const OUTCOME_COLORS: Record<string, string> = {
  routine: "#0f766e",
  assess_soon: "#f59e0b",
  urgent: "#be123c",
};

export function ActiveUsersTrendChart({ data }: { data: WeeklyPoint[] }) {
  const t = useTranslations("StaffDashboard");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("charts.activeUsersTrend")}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#0f766e" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export function OutcomeDistributionChart({ data }: { data: GroupedPoint[] }) {
  const t = useTranslations("StaffDashboard");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">
        {t("charts.outcomeDistribution")}
      </h2>
      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="group" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value">
              {data.map((entry) => (
                <Cell
                  key={entry.group}
                  fill={OUTCOME_COLORS[entry.group] ?? "#525252"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}

export function LanguageSplitChart({ data }: { data: GroupedPoint[] }) {
  const t = useTranslations("StaffDashboard");
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{t("charts.languageSplit")}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noData")}</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="group" tick={{ fontSize: 10 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#0369a1" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}
