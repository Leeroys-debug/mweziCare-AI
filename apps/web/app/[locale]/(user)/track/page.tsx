"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { LogCalendar } from "@/components/track/log-calendar";

interface Cycle {
  startDate: string;
  endDate: string;
  periodLengthDays: number;
  cycleLengthDays: number | null;
}

interface CyclesResponse {
  cycles: Cycle[];
  nextPeriodEstimate: { date: string; isEstimate: true } | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function diffDaysIso(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00.000Z`).getTime() -
    new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function daysUntil(dateIso: string): number {
  const today = todayIso();
  return diffDaysIso(today, dateIso);
}

/** Current cycle/period day, computed client-side from already-fetched cycle dates — display only, not a clinical inference (CLAUDE.md: urgency/clinical content is the rules engine's job, never the UI's). */
function useCycleDayHero(cyclesData: CyclesResponse | undefined) {
  return useMemo(() => {
    const cycles = cyclesData?.cycles ?? [];
    const latest = cycles[cycles.length - 1];
    if (!latest) return null;

    const today = todayIso();
    const dayNumber = diffDaysIso(latest.startDate, today) + 1;
    if (dayNumber < 1) return null;

    const isPeriodDay = today >= latest.startDate && today <= latest.endDate;
    return { dayNumber, isPeriodDay };
  }, [cyclesData]);
}

/**
 * Period-calendar tracking only — kept deliberately separate from the
 * Symptoms tab's diagnosis questions (no link between the two screens),
 * per the user's request to not blend period-calendar tracking with the
 * triage question set. LogCalendar itself is the single interactive
 * calendar (week by default, expandable to the full month) — this page
 * just adds the plain-text countdown above it.
 */
export default function TrackPage() {
  const t = useTranslations("Track");

  const { data: cyclesData } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CyclesResponse> => {
      const response = await fetch("/api/v1/cycles");
      if (!response.ok) throw new Error("Failed to load cycles");
      return response.json() as Promise<CyclesResponse>;
    },
  });
  const hero = useCycleDayHero(cyclesData);
  const daysToNextPeriod = cyclesData?.nextPeriodEstimate
    ? Math.max(0, daysUntil(cyclesData.nextPeriodEstimate.date))
    : null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {hero && (hero.isPeriodDay || daysToNextPeriod != null) && (
        <div className="-mx-4 -mt-1 bg-gradient-to-b from-brand-100 to-transparent px-4 py-4 text-center dark:from-brand-950">
          {hero.isPeriodDay ? (
            <>
              <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                {t("hero.periodLabel")}
              </p>
              <p className="text-4xl font-bold text-brand-900 dark:text-brand-100">
                {t("hero.day", { day: hero.dayNumber })}
              </p>
            </>
          ) : (
            daysToNextPeriod != null && (
              <p className="text-4xl font-bold text-brand-900 dark:text-brand-100">
                {daysToNextPeriod === 0
                  ? t("hero.periodDueToday")
                  : t("hero.periodInDays", { days: daysToNextPeriod })}
              </p>
            )
          )}
        </div>
      )}

      <LogCalendar />
    </div>
  );
}
