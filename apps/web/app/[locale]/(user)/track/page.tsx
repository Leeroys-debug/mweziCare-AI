"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { DailyLogForm } from "@/components/track/daily-log-form";
import { LogCalendar } from "@/components/track/log-calendar";
import { UrgentCareOverlay } from "@/components/urgent-care-overlay";
import { Day30QuizBanner } from "@/components/quiz/day30-banner";
import { trackClientEvent } from "@/lib/analytics-client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TrackPage() {
  const t = useTranslations("Track");
  const [view, setView] = useState<"today" | "calendar">("today");
  const [showUrgent, setShowUrgent] = useState(false);

  useEffect(() => {
    if (showUrgent) void trackClientEvent("urgent_screen_shown", {});
  }, [showUrgent]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <Day30QuizBanner />

      <div
        role="tablist"
        aria-label={t("viewSwitcherLabel")}
        className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900"
      >
        <Button
          type="button"
          role="tab"
          aria-selected={view === "today"}
          variant={view === "today" ? "default" : "ghost"}
          onClick={() => setView("today")}
        >
          {t("todayTab")}
        </Button>
        <Button
          type="button"
          role="tab"
          aria-selected={view === "calendar"}
          variant={view === "calendar" ? "default" : "ghost"}
          onClick={() => setView("calendar")}
        >
          {t("calendarTab")}
        </Button>
      </div>

      {view === "today" ? (
        <DailyLogForm date={todayIso()} onUrgent={() => setShowUrgent(true)} />
      ) : (
        <LogCalendar onUrgent={() => setShowUrgent(true)} />
      )}

      {showUrgent && (
        <UrgentCareOverlay onAcknowledge={() => setShowUrgent(false)} />
      )}
    </div>
  );
}
