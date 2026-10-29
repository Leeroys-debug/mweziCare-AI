"use client";

import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useLiveQuery } from "dexie-react-hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, cn } from "@mwezicare/ui";
import { offlineDb } from "@/lib/offline-db";
import { DailyLogForm } from "./daily-log-form";

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

export interface LogCalendarProps {
  onUrgent?: () => void;
}

export function LogCalendar({ onUrgent }: LogCalendarProps) {
  const t = useTranslations("Track");
  const queryClient = useQueryClient();
  const today = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, negative = past
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
  const from = toIsoDate(monthStart);
  const to = toIsoDate(monthEnd);

  const { data } = useQuery({
    queryKey: ["logs", from, to],
    queryFn: async (): Promise<CalendarLog[]> => {
      const response = await fetch(`/api/v1/logs?from=${from}&to=${to}`);
      if (!response.ok) throw new Error("Failed to load logs");
      const body = (await response.json()) as { logs: CalendarLog[] };
      return body.logs;
    },
  });

  // Shared cache key with the Track/Insights pages — reuses their fetch
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

  const leadingBlanks = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toIsoDate(
        new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), i + 1),
      ),
    ),
  ];

  const monthLabel = viewedMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  function closeSheet() {
    setSelectedDate(null);
    void queryClient.invalidateQueries({ queryKey: ["logs"] });
  }

  function goToPreviousMonth() {
    setMonthOffset((m) => m - 1);
  }
  function goToNextMonth() {
    setMonthOffset((m) => Math.min(MAX_FORWARD_OFFSET, m + 1));
  }

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  function handlePointerDown(event: React.PointerEvent) {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  }
  function handlePointerUp(event: React.PointerEvent) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.5)
      return;
    if (dx < 0) goToNextMonth();
    else goToPreviousMonth();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
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
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-500 dark:text-neutral-400">
        {t.raw("weekdayAbbrev").map((day: string) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className="grid touch-pan-y grid-cols-7 gap-1"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        {cells.map((date, i) => {
          if (date == null) return <div key={`blank-${i}`} />;

          const log = logsByDate.get(date);
          const isPeriodDay = log?.periodDay ?? false;
          const painScore = log?.painScore ?? null;
          const badgeClass = painBadgeClass(painScore);
          const isToday = date === toIsoDate(today);
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
              onClick={() => setSelectedDate(date)}
              aria-label={srParts.join(" — ")}
              className={cn(
                "relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-full text-xs font-medium transition-colors active:scale-95",
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

      <Dialog.Root
        open={selectedDate != null}
        onOpenChange={(open) => !open && closeSheet()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-neutral-950">
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold">
                  {selectedDate}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("close")}
                  >
                    ✕
                  </Button>
                </Dialog.Close>
              </div>
              {selectedDate && (
                <DailyLogForm
                  date={selectedDate}
                  onSaved={closeSheet}
                  onUrgent={() => {
                    closeSheet();
                    onUrgent?.();
                  }}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
