"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";

export function LocationConsent({ onAllow }: { onAllow: () => void }) {
  const t = useTranslations("Care");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm font-medium">{t("locationConsentTitle")}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("locationConsentBody")}
      </p>
      <Button type="button" onClick={onAllow}>
        {t("shareLocation")}
      </Button>
      <p className="text-xs text-neutral-500">
        {t("manualSearchAlwaysAvailable")}
      </p>
    </div>
  );
}
