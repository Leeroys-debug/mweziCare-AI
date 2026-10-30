"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DailyLogForm } from "@/components/track/daily-log-form";
import { LearnCarousel } from "@/components/track/learn-carousel";
import { UrgentCareOverlay } from "@/components/urgent-care-overlay";
import { Day30QuizBanner } from "@/components/quiz/day30-banner";
import { trackClientEvent } from "@/lib/analytics-client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Today's symptom/diagnosis questions only — deliberately has no calendar
 * or period-toggle UI (that lives on its own Track tab), per the user's
 * request to keep the two distinct rather than bundled in one view.
 */
export default function SymptomsPage() {
  const t = useTranslations("Track");
  const [showUrgent, setShowUrgent] = useState(false);
  const today = todayIso();

  useEffect(() => {
    if (showUrgent) void trackClientEvent("urgent_screen_shown", {});
  }, [showUrgent]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("symptomsTitle")}</h1>

      <Day30QuizBanner />

      <LearnCarousel />

      <DailyLogForm date={today} onUrgent={() => setShowUrgent(true)} />

      {showUrgent && (
        <UrgentCareOverlay onAcknowledge={() => setShowUrgent(false)} />
      )}
    </div>
  );
}
