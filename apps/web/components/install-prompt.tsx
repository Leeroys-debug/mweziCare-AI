"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@mwezicare/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Chromium fires `beforeinstallprompt` once and then suppresses its own
 * mini-infobar if we call preventDefault() — this is the custom UI that
 * replaces it. Not shown again this session once dismissed or installed.
 */
export function InstallPrompt() {
  const t = useTranslations("InstallPrompt");
  const [deferredEvent, setDeferredEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!deferredEvent || dismissed) return null;

  async function install() {
    await deferredEvent!.prompt();
    await deferredEvent!.userChoice;
    setDeferredEvent(null);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950">
      <span className="text-emerald-900 dark:text-emerald-100">
        {t("body")}
      </span>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void install()}>
          {t("install")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
        >
          {t("dismiss")}
        </Button>
      </div>
    </div>
  );
}
