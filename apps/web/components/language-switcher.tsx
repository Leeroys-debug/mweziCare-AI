"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@mwezicare/ui";

export function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="inline-flex overflow-hidden rounded-md border border-neutral-300 text-sm dark:border-neutral-700"
    >
      {routing.locales.map((candidate) => (
        <Link
          key={candidate}
          href={pathname}
          locale={candidate}
          aria-current={candidate === locale ? "true" : undefined}
          className={cn(
            "px-3 py-1.5",
            candidate === locale
              ? "bg-emerald-700 text-white"
              : "bg-transparent text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
          )}
        >
          {t(candidate)}
        </Link>
      ))}
    </div>
  );
}
