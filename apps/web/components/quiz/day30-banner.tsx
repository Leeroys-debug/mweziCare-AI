"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { Link } from "@/i18n/navigation";

export function Day30QuizBanner() {
  const t = useTranslations("Quiz");
  const [dueDay30, setDueDay30] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/v1/quiz/status");
        if (!response.ok) return;
        const body = (await response.json()) as { dueDay30: boolean };
        setDueDay30(body.dueDay30);
      } catch {
        // Best-effort — no banner if the status check fails.
      }
    })();
  }, []);

  if (!dueDay30 || dismissed) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
      <p className="font-semibold text-emerald-900 dark:text-emerald-100">
        {t("day30BannerTitle")}
      </p>
      <p className="text-sm text-emerald-800 dark:text-emerald-200">
        {t("day30BannerBody")}
      </p>
      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href="/quiz?kind=day30">{t("day30BannerCta")}</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
        >
          {t("day30BannerDismiss")}
        </Button>
      </div>
    </div>
  );
}
