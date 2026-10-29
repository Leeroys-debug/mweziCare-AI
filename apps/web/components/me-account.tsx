"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";
import { signOut } from "@/lib/auth-client";
import { DiscreetModeToggle } from "@/components/discreet-mode-toggle";

export interface ConsentRow {
  purpose: "tracking" | "location" | "research" | "sharing";
  granted: boolean;
}

const WITHDRAWABLE_PURPOSES: ConsentRow["purpose"][] = [
  "location",
  "research",
  "sharing",
];

export function MeAccount({ consents }: { consents: ConsentRow[] }) {
  const t = useTranslations("Me");
  const router = useRouter();
  const [rows, setRows] = useState(consents);
  const [deleting, setDeleting] = useState(false);

  const consentFor = (purpose: ConsentRow["purpose"]) =>
    rows.find((row) => row.purpose === purpose)?.granted ?? false;

  async function withdraw(purpose: ConsentRow["purpose"]) {
    await fetch(`/api/v1/me/consents/${purpose}`, { method: "DELETE" });
    setRows((prev) =>
      prev.map((row) =>
        row.purpose === purpose ? { ...row, granted: false } : row,
      ),
    );
  }

  async function grant(purpose: ConsentRow["purpose"]) {
    await fetch(`/api/v1/me/consents/${purpose}`, { method: "POST" });
    setRows((prev) =>
      prev.map((row) =>
        row.purpose === purpose ? { ...row, granted: true } : row,
      ),
    );
  }

  async function downloadExport() {
    const response = await fetch("/api/v1/me/export");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mwezicare-data.pdf";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (!window.confirm(t("deleteConfirm"))) return;
    setDeleting(true);
    try {
      await fetch("/api/v1/me", { method: "DELETE" });
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("consentsTitle")}</h2>
        {WITHDRAWABLE_PURPOSES.map((purpose) => (
          <div
            key={purpose}
            data-testid="consent-row"
            data-purpose={purpose}
            className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
          >
            <div>
              <div className="font-medium capitalize">{purpose}</div>
              <div className="text-neutral-500">
                {consentFor(purpose)
                  ? t("consentGranted")
                  : t("consentNotGranted")}
              </div>
            </div>
            {consentFor(purpose) ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => withdraw(purpose)}
              >
                {t("withdraw")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => grant(purpose)}
              >
                {t("grant")}
              </Button>
            )}
          </div>
        ))}
      </section>

      <DiscreetModeToggle />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{t("exportTitle")}</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("exportBody")}
        </p>
        <Button variant="outline" onClick={downloadExport}>
          {t("exportButton")}
        </Button>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-red-200 p-4 dark:border-red-900">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">
          {t("deleteTitle")}
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("deleteBody")}
        </p>
        <Button
          variant="outline"
          disabled={deleting}
          onClick={deleteAccount}
          className="border-red-600 text-red-700 hover:bg-red-50"
        >
          {t("deleteButton")}
        </Button>
      </section>

      <Button
        variant="ghost"
        onClick={async () => {
          await signOut();
          router.push("/");
          router.refresh();
        }}
      >
        {t("signOut")}
      </Button>
    </div>
  );
}
