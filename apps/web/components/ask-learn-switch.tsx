"use client";

import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * Persistent Ask/Learn tab switcher shown on the Assistant page and both
 * Learn pages — Learn needs its own URLs (direct-linked from source chips
 * and the Track carousel), so this is route-based rather than client state,
 * but it reads as a single tab pair wherever it appears.
 */
export function AskLearnSwitch() {
  const t = useTranslations("AskLearnSwitch");
  const pathname = usePathname();
  const isLearn = pathname.startsWith("/learn");

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900"
    >
      <Button
        asChild
        role="tab"
        aria-selected={!isLearn}
        variant={isLearn ? "ghost" : "default"}
      >
        <Link href="/assistant">{t("ask")}</Link>
      </Button>
      <Button
        asChild
        role="tab"
        aria-selected={isLearn}
        variant={isLearn ? "default" : "ghost"}
      >
        <Link href="/learn">{t("learn")}</Link>
      </Button>
    </div>
  );
}
