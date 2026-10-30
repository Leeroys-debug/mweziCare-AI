"use client";

import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button, PainSlider, cn } from "@mwezicare/ui";
import { offlineDb } from "@/lib/offline-db";
import { setPainForDate, togglePeriodForDate } from "@/lib/quick-log";

interface CalendarLog {
  logDate: string;
  periodDay: boolean;
  painScore: number | null;
}

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

/** Furthest a swipe/arrow can move past the current month — predictions only reach one period out. */
const MAX_FORWARD_OFFSET = 1;
/** Horizontal drag distance (px) that counts as a swipe rather than a tap or vertical scroll. */
const SWIPE_THRESHOLD_PX = 50;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Monday-Sunday week containing `iso`, as 7 YYYY-MM-DD strings. */
function weekDates(iso: string): string[] {
  const jsDay = new Date(`${iso}T00:00:00.000Z`).getUTCDay(); // 0=Sun..6=Sat
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = addDaysIso(iso, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
}

/**
 * Last estimated period, shaded as a range the same way Flo shows predicted
 * days (dotted ring, not a solid fill) — display only, derived entirely from
 * already-computed cycle data, never a new clinical inference.
 */
function predictedPeriodRange(
  cycles: Cycle[],
  estimate: { date: string } | null | undefined,
): { from: string; to: string } | null {
  if (!estimate) return null;
  const recentLengths = cycles
    .map((c) => c.periodLengthDays)
    .filter((n): n is number => n != null)
    .slice(-3);
  const avgLength =
    recentLengths.length > 0
      ? Math.round(
          recentLengths.reduce((sum, n) => sum + n, 0) / recentLengths.length,
        )
      : 5;
  return { from: estimate.date, to: addDaysIso(estimate.date, avgLength - 1) };
}

/** Small pain-severity badge color — a secondary signal, kept separate from the period-day fill so the two don't visually compete on the same cell. */
function painBadgeClass(painScore: number | null): string | null {
  if (painScore == null || painScore === 0) return null;
  if (painScore <= 3) return "bg-amber-400 dark:bg-amber-500";
  if (painScore <= 6) return "bg-orange-500 dark:bg-orange-600";
  return "bg-red-600 dark:bg-red-700";
}

/**
 * Period-calendar — tapping a day toggles its period status directly, and
 * the strip under the grid also lets you log a pain score for that day.
 * Deliberately stops short of the full symptom/diagnosis question form
 * (that lives on its own Symptoms tab) — see the user's request to keep
 * calendar tracking and the triage questions distinct, not bridged.
 *
 * Defaults to a week view (the "top strip" the user wanted, now the same
 * interactive component as the month grid instead of a separate static
 * row) with an option to expand to the full month, so there's only ever
 * one calendar on screen, not two.
 */
export function LogCalendar() {
  const t = useTranslations("Track");
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(today), [today]);
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, negative = past
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);
  const [painDraft, setPainDraft] = useState(0);
  const [savingPain, setSavingPain] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const viewedMonth = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1,
  );
  const monthStart = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth(),
    1,
  );
  const monthEnd = new Date(
    viewedMonth.getFullYear(),
    viewedMonth.getMonth() + 1,
    0,
  );
  const week = useMemo(() => weekDates(todayIso), [todayIso]);

  const from = viewMode === "week" ? week[0]! : toIsoDate(monthStart);
  const to = viewMode === "week" ? week[6]! : toIsoDate(monthEnd);

  const { data } = useQuery({
    queryKey: ["logs", from, to],
    queryFn: async (): Promise<CalendarLog[]> => {
      const response = await fetch(`/api/v1/logs?from=${from}&to=${to}`);
      if (!response.ok) throw new Error("Failed to load logs");
      const body = (await response.json()) as { logs: CalendarLog[] };
      return body.logs;
    },
  });

  // Shared cache key with the Calendar/Insights pages — reuses their fetch
  // when already in the query cache instead of duplicating the request.
  const { data: cyclesData } = useQuery({
    queryKey: ["cycles"],
    queryFn: async (): Promise<CyclesResponse> => {
      const response = await fetch("/api/v1/cycles");
      if (!response.ok) throw new Error("Failed to load cycles");
      return response.json() as Promise<CyclesResponse>;
    },
  });
  const predictedRange = predictedPeriodRange(
    cyclesData?.cycles ?? [],
    cyclesData?.nextPeriodEstimate,
  );

  // Offline-first: local (possibly not-yet-synced) logs take precedence over
  // the server's view for the same date, so a log saved while offline shows
  // up on the calendar immediately, not just after it syncs.
  const localLogs = useLiveQuery(
    () =>
      offlineDb.logs.where("logDate").between(from, to, true, true).toArray(),
    [from, to],
  );

  const logsByDate = useMemo(() => {
    const map = new Map<string, CalendarLog>();
    for (const log of data ?? []) map.set(log.logDate, log);
    for (const log of localLogs ?? []) {
      map.set(log.logDate, {
        logDate: log.logDate,
        periodDay: log.periodDay,
        painScore: log.painScore ?? null,
      });
    }
    return map;
  }, [data, localLogs]);

  const cells: (string | null)[] =
    viewMode === "week"
      ? week
      : [
          ...Array.from({ length: monthStart.getDay() }, () => null),
          ...Array.from({ length: monthEnd.getDate() }, (_, i) =>
            toIsoDate(
              new Date(
                viewedMonth.getFullYear(),
                viewedMonth.getMonth(),
                i + 1,
              ),
            ),
          ),
        ];

  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function goToPreviousMonth() {
    setMonthOffset((m) => m - 1);
  }
  function goToNextMonth() {
    setMonthOffset((m) => Math.min(MAX_FORWARD_OFFSET, m + 1));
  }
  function expandToMonth() {
    setMonthOffset(0);
    setViewMode("month");
  }
  function collapseToWeek() {
    setViewMode("week");
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    setPainDraft(logsByDate.get(date)?.painScore ?? 0);
  }

  /** Tapping a day marks/unmarks it as a period day directly — pain is logged via the slider in the strip below. */
  async function handleDayTap(date: string) {
    selectDate(date);
    setTogglingDate(date);
    setActionError(null);
    try {
      await togglePeriodForDate(date);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["logs"] }),
        queryClient.invalidateQueries({ queryKey: ["cycles"] }),
      ]);
    } catch (err) {
      // Previously unhandled — a throw here (e.g. IndexedDB write failure)
      // left the tap looking like it did nothing at all.
      setActionError(
        err instanceof Error ? err.message : "Failed to log period",
      );
    } finally {
      setTogglingDate((current) => (current === date ? null : current));
    }
  }

  async function handleSavePain() {
    if (!selectedDate) return;
    setSavingPain(true);
    setActionError(null);
    try {
      await setPainForDate(selectedDate, painDraft);
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to log pain");
    } finally {
      setSavingPain(false);
    }
  }

  // Pointer-based swipe (month view only): pointerId is tracked so a second
  // finger/pointer mid-gesture can't corrupt the first's delta, and
  // pointercancel (the browser taking the gesture over, e.g. a system
  // edge-swipe) clears the ref instead of leaving a stale start point for
  // the next gesture.
  const swipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(
    null,
  );
  function handlePointerDown(event: React.PointerEvent) {
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  }
  function handlePointerUp(event: React.PointerEvent) {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    swipeStart.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5)
      return;
    if (dx < 0) goToNextMonth();
    else goToPreviousMonth();
  }
  function handlePointerCancel(event: React.PointerEvent) {
    if (swipeStart.current?.pointerId === event.pointerId) {
      swipeStart.current = null;
    }
  }

  const painScoreLabels = Array.from({ length: 11 }, (_, i) =>
    t(`painScoreLabel.${i}`),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {viewMode === "month" ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToPreviousMonth}
              aria-label={t("previousMonth")}
            >
              ‹
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{monthLabel}</span>
              {monthOffset !== 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMonthOffset(0)}
                >
                  {t("jumpToToday")}
                </Button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goToNextMonth}
              disabled={monthOffset === MAX_FORWARD_OFFSET}
              aria-label={t("nextMonth")}
            >
              ›
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold">{t("thisWeekLabel")}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={expandToMonth}
            >
              {t("showFullMonth")}
            </Button>
          </>
        )}
      </div>

      {viewMode === "month" && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={collapseToWeek}
          >
            {t("showWeek")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
        {t.raw("weekdayAbbrev").map((day: string) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className="grid touch-pan-y grid-cols-7 gap-1"
        style={{ touchAction: "pan-y" }}
        onPointerDown={viewMode === "month" ? handlePointerDown : undefined}
        onPointerUp={viewMode === "month" ? handlePointerUp : undefined}
        onPointerCancel={viewMode === "month" ? handlePointerCancel : undefined}
      >
        {cells.map((date, i) => {
          if (date == null) return <div key={`blank-${i}`} />;

          const log = logsByDate.get(date);
          const isPeriodDay = log?.periodDay ?? false;
          const painScore = log?.painScore ?? null;
          const badgeClass = painBadgeClass(painScore);
          const isToday = date === todayIso;
          const isPredictedPeriod =
            !isPeriodDay &&
            !!predictedRange &&
            date >= predictedRange.from &&
            date <= predictedRange.to;

          const srParts = [date];
          if (isPeriodDay) srParts.push(t("periodDay"));
          else if (isPredictedPeriod) srParts.push(t("predictedPeriodDay"));
          if (painScore)
            srParts.push(`${t("painScoreLabel.title")} ${painScore}`);

          return (
            <button
              key={date}
              type="button"
              onClick={() => void handleDayTap(date)}
              disabled={togglingDate === date}
              aria-label={srParts.join(" — ")}
              className={cn(
                "relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition-all active:scale-95",
                togglingDate === date && "opacity-50",
                isPeriodDay
                  ? "bg-brand-600 text-white"
                  : "text-neutral-900 dark:text-neutral-100",
                isPredictedPeriod &&
                  "border-2 border-dotted border-brand-500 dark:border-brand-400",
                isToday &&
                  !isPeriodDay &&
                  "border-2 border-dashed border-brand-600",
                isToday &&
                  isPeriodDay &&
                  "ring-2 ring-brand-900 dark:ring-brand-200",
                selectedDate === date &&
                  "ring-2 ring-offset-2 ring-brand-700 dark:ring-brand-300",
              )}
            >
              <span aria-hidden="true">{Number(date.slice(-2))}</span>
              {badgeClass && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "rounded-full px-1 text-[9px] font-bold leading-tight text-white",
                    badgeClass,
                  )}
                >
                  {painScore}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="flex flex-col gap-3 rounded-lg border border-brand-300 bg-brand-50 p-3 dark:border-brand-800 dark:bg-brand-950">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
                {selectedDate}
              </p>
              <p className="text-xs text-brand-700 dark:text-brand-300">
                {logsByDate.get(selectedDate)?.periodDay
                  ? t("calendarDayStatus.periodDay")
                  : t("calendarDayStatus.notPeriodDay")}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("close")}
              onClick={() => setSelectedDate(null)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-brand-700 hover:bg-brand-100 dark:text-brand-300 dark:hover:bg-brand-900"
            >
              <X size={18} />
            </button>
          </div>

          <PainSlider
            value={painDraft}
            onChange={setPainDraft}
            label={t("painScoreLabel.title")}
            valueLabels={painScoreLabels}
          />
          <Button
            type="button"
            size="sm"
            disabled={savingPain}
            onClick={() => void handleSavePain()}
          >
            {savingPain ? t("saving") : t("savePainButton")}
          </Button>
          {actionError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {t("saveError")}: {actionError}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full bg-brand-600"
            aria-hidden="true"
          />
          {t("legend.periodDay")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border-2 border-dotted border-brand-500 dark:border-brand-400"
            aria-hidden="true"
          />
          {t("legend.predictedPeriod")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border-2 border-dashed border-brand-600"
            aria-hidden="true"
          />
          {t("legend.today")}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full bg-orange-500"
            aria-hidden="true"
          />
          {t("legend.painLogged")}
        </span>
      </div>
    </div>
  );
}
