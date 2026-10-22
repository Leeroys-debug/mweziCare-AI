"use client";

import { useMemo, useState } from "react";
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

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function painBucketClass(painScore: number | null): string {
  if (painScore == null || painScore === 0) return "";
  if (painScore <= 3) return "bg-amber-100 dark:bg-amber-950";
  if (painScore <= 6) return "bg-orange-200 dark:bg-orange-900";
  return "bg-red-300 dark:bg-red-900";
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((m) => m - 1)}
          aria-label={t("previousMonth")}
        >
          ‹
        </Button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
          disabled={monthOffset === 0}
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

      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) =>
          date == null ? (
            <div key={`blank-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex min-h-[44px] flex-col items-center justify-center rounded-md border border-neutral-200 text-xs dark:border-neutral-800",
                painBucketClass(logsByDate.get(date)?.painScore ?? null),
              )}
            >
              <span>{Number(date.slice(-2))}</span>
              <span className="flex gap-0.5">
                {logsByDate.get(date)?.periodDay && (
                  <span
                    className="rounded bg-rose-700 px-1 text-[10px] font-bold text-white"
                    aria-label={t("periodDay")}
                  >
                    P
                  </span>
                )}
                {logsByDate.get(date)?.painScore != null &&
                  logsByDate.get(date)!.painScore! > 0 && (
                    <span aria-hidden="true">
                      {logsByDate.get(date)!.painScore}
                    </span>
                  )}
              </span>
            </button>
          ),
        )}
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
