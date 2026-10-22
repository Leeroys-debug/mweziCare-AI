"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";

const COOKIE_NAME = "discreetMode";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

/**
 * Discretion (CLAUDE.md / E2 spec): when on, the installed app's name/icon
 * never reveal what it's for — see app/manifest.ts, which reads this same
 * cookie server-side. Not httpOnly on purpose, so this toggle can flip it
 * without a round trip.
 */
export function DiscreetModeToggle() {
  const t = useTranslations("Me");
  const [enabled, setEnabled] = useState(
    () => typeof document !== "undefined" && readCookie(COOKIE_NAME) === "1",
  );

  function toggle() {
    const next = !enabled;
    document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=${ONE_YEAR_SECONDS}`;
    setEnabled(next);
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{t("discreetModeTitle")}</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t("discreetModeBody")}
      </p>
      <Button variant="outline" onClick={toggle} aria-pressed={enabled}>
        {enabled ? t("discreetModeOn") : t("discreetModeOff")}
      </Button>
    </section>
  );
}
