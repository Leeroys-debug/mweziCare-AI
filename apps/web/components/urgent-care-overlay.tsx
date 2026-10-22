"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { Link } from "@/i18n/navigation";

/**
 * Full-screen urgent-care card — shown right after a log save that the
 * client-side red-flag check (packages/rules-engine's urgentOnlyRuleset)
 * resolved to "urgent". No backdrop, no Escape handler: the only ways out
 * are the explicit acknowledgement or navigating to Care, per CLAUDE.md
 * ("must not be dismissible without acknowledgement").
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
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-red-700 p-6 text-white"
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5">
        <h1 id="urgent-overlay-title" className="text-2xl font-bold">
          {t("title")}
        </h1>
        <p className="text-base">{t("body")}</p>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>{t("step1")}</li>
          <li>{t("step2")}</li>
          <li>{t("step3")}</li>
        </ul>
        <p className="text-sm text-red-100">{t("uncertaintyNote")}</p>
        <div className="flex flex-col gap-3 pt-2">
          <Button
            asChild
            size="lg"
            className="bg-white text-red-700 hover:bg-red-50"
          >
            <Link href="/care">{t("findCare")}</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-red-800"
            onClick={onAcknowledge}
          >
            {t("acknowledge")}
          </Button>
        </div>
      </div>
    </div>
  );
}
