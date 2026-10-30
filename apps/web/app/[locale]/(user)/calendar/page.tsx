"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@mwezicare/ui";
import { LogCalendar } from "@/components/track/log-calendar";
import { togglePeriodForDate } from "@/lib/quick-log";

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

interface WeekLog {
  logDate: string;
  periodDay: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDaysIso(from: string, to: string): number {
  const ms =
    new Date(`${to}T00:00:00.000Z`).getTime() -
    new Date(`${from}T00:00:00.000Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function daysUntil(dateIso: string): number {
  const today = todayIso();
  const ms =
    new Date(`${dateIso}T00:00:00.000Z`).getTime() -
    new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/** Monday-Sunday week containing `iso`, as 7 YYYY-MM-DD strings. */
function weekDates(iso: string): string[] {
  const jsDay = new Date(`${iso}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = addDaysIso(iso, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
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
 * triage question set.
 */
export default function CalendarPage() {
  const t = useTranslations("Track");
  const queryClient = useQueryClient();
  const [togglingPeriod, setTogglingPeriod] = useState(false);
  const today = todayIso();
  const week = useMemo(() => weekDates(today), [today]);

  const { data: cyclesData } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CyclesResponse> => {
      const response = await fetch("/api/v1/cycles");
      if (!response.ok) throw new Error("Failed to load cycles");
      return response.json() as Promise<CyclesResponse>;
    },
  });
  const hero = useCycleDayHero(cyclesData);

  const { data: weekLogsData } = useQuery({
    queryKey: ["logs", week[0], week[6]],
    queryFn: async (): Promise<WeekLog[]> => {
      const response = await fetch(
        `/api/v1/logs?from=${week[0]}&to=${week[6]}`,
      );
      if (!response.ok) throw new Error("Failed to load logs");
      const body = (await response.json()) as { logs: WeekLog[] };
      return body.logs;
    },
  });
  const periodDatesThisWeek = useMemo(
    () =>
      new Set(
        (weekLogsData ?? []).filter((l) => l.periodDay).map((l) => l.logDate),
      ),
    [weekLogsData],
  );

  const isTodayPeriodDay = periodDatesThisWeek.has(today);
  const daysToNextPeriod = cyclesData?.nextPeriodEstimate
    ? Math.max(0, daysUntil(cyclesData.nextPeriodEstimate.date))
    : null;

  async function handleLogPeriod() {
    setTogglingPeriod(true);
    try {
      await togglePeriodForDate(today);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
        queryClient.invalidateQueries({ queryKey: ["cycles"] }),
      ]);
    } finally {
      setTogglingPeriod(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-4 -mt-4 flex flex-col gap-5 bg-gradient-to-b from-brand-100 to-transparent px-4 pb-5 pt-6 dark:from-brand-950">
        <div
          className="flex justify-between gap-1"
          role="group"
          aria-label={t("hero.weekLabel")}
        >
          {week.map((date) => {
            const dayLabel = new Date(
              `${date}T00:00:00.000Z`,
            ).toLocaleDateString(undefined, {
              weekday: "narrow",
              timeZone: "UTC",
            });
            const isToday = date === today;
            const isPeriod = periodDatesThisWeek.has(date);
            return (
              <div
                key={date}
                className="flex flex-col items-center gap-1"
                aria-current={isToday ? "date" : undefined}
              >
                <span className="text-[10px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
                  {dayLabel}
                </span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    isPeriod
                      ? "bg-brand-600 text-white"
                      : isToday
                        ? "border-2 border-dashed border-brand-600 text-brand-700 dark:text-brand-300"
                        : "text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
              </div>
            );
          })}
        </div>

        {hero && (hero.isPeriodDay || daysToNextPeriod != null) && (
          <div className="text-center">
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

        <div className="flex justify-center">
          <Button
            type="button"
            variant={isTodayPeriodDay ? "default" : "outline"}
            disabled={togglingPeriod}
            onClick={() => void handleLogPeriod()}
          >
            {isTodayPeriodDay
              ? t("quickActions.periodLogged")
              : t("quickActions.logPeriod")}
          </Button>
        </div>
      </div>

      <h1 className="text-2xl font-semibold">{t("calendarTitle")}</h1>

      <LogCalendar />
    </div>
  );
}
