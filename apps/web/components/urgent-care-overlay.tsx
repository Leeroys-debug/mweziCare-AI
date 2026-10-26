"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { Link } from "@/i18n/navigation";

/**
 * Full-screen urgent-care card — shown right after a log save that the
 * client-side red-flag check (packages/rules-engine's urgentOnlyRuleset)
 * resolved to "urgent". No backdrop, no Escape handler: the only ways out
 * are the explicit acknowledgement or navigating to Care, per CLAUDE.md
 * ("must not be dismissible without acknowledgement"). Styled as a calm
 * white card with a red accent rather than a full-bleed red screen — the
 * urgency is carried by the icon/wording/required-acknowledgement, not by
 * flooding the viewport with alarm-red.
 */
export function UrgentCareOverlay({
  onAcknowledge,
}: {
  onAcknowledge: () => void;
}) {
  const t = useTranslations("Track.urgentOverlay");

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="urgent-overlay-title"
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-white p-6 dark:bg-neutral-950"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <h1
            id="urgent-overlay-title"
            className="text-xl font-bold text-red-700 dark:text-red-300"
          >
            {t("title")}
          </h1>
        </div>
        <p className="text-base text-neutral-800 dark:text-neutral-100">
          {t("body")}
        </p>
        <ul className="list-disc space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 pl-9 text-sm text-neutral-800 dark:border-red-900 dark:bg-red-950/40 dark:text-neutral-100">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ul>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("uncertaintyNote")}
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Button asChild size="lg" className="bg-red-700 hover:bg-red-800">
            <Link href="/care">{t("findCare")}</Link>
          </Button>
          <Button size="lg" variant="outline" onClick={onAcknowledge}>
            {t("acknowledge")}
          </Button>
        </div>
      </div>
    </div>
  );
}
