"use client";

import { useTranslations } from "next-intl";

export function UrgentCareBanner() {
  const t = useTranslations("Care");
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
    >
      <p className="font-semibold">{t("urgentBanner.title")}</p>
      <p>{t("urgentBanner.body")}</p>
    </div>
  );
}
