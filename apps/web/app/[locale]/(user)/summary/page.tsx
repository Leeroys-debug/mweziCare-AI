"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useLocale, useTranslations } from "next-intl";
import { Button, Chip } from "@mwezicare/ui";
import type { SummaryData } from "@mwezicare/triage";
import { SummaryView } from "@/components/summary/summary-view";
import type { SummaryPdfLabels } from "@/lib/summary-pdf";
import { Link } from "@/i18n/navigation";

type Range = "3_cycles" | "6_cycles" | "custom";

interface CreateResponse {
  token: string;
  summary: { id: string; period: string; expiresAt: string; viewCount: number };
  data: SummaryData;
  labels: SummaryPdfLabels;
  ageBand: string;
}

export default function SummaryPage() {
  const t = useTranslations("Summary");
  const locale = useLocale();
  const [range, setRange] = useState<Range>("3_cycles");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [displayLabel, setDisplayLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResponse | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const shareUrl = result
    ? `${window.location.origin}/s/${result.token}`
    : null;

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl)
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [shareUrl]);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          range,
          from: range === "custom" ? from : undefined,
          to: range === "custom" ? to : undefined,
          displayLabel: displayLabel || undefined,
        }),
      });
      if (response.status === 403) {
        setError(t("sharingConsentRequired"));
        return;
      }
      if (!response.ok) {
        setError(t("generateError"));
        return;
      }
      const body = (await response.json()) as CreateResponse;
      setResult(body);
      setRevoked(false);
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (!result) return;
    await fetch(`/api/v1/summaries/${result.summary.id}/revoke`, {
      method: "POST",
    });
    setRevoked(true);
  }

  async function copyLink() {
    if (shareUrl) await navigator.clipboard.writeText(shareUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("createTitle")}</h1>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {t("rangeLabel")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {(["3_cycles", "6_cycles", "custom"] as const).map((option) => (
            <Chip
              key={option}
              selected={range === option}
              onClick={() => setRange(option)}
            >
              {t(`range.${option}`)}
            </Chip>
          ))}
        </div>
        {range === "custom" && (
          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("displayLabelLabel")}
        <input
          value={displayLabel}
          onChange={(e) => setDisplayLabel(e.target.value)}
          placeholder={t("displayLabelPlaceholder")}
          className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600">
          {error}{" "}
          {error === t("sharingConsentRequired") && (
            <Link href="/me" className="underline">
              {t("goToConsents")}
            </Link>
          )}
        </p>
      )}

      <Button type="button" onClick={generate} disabled={pending}>
        {pending ? t("generating") : t("generateButton")}
      </Button>

      {result && (
        <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <SummaryView
            data={result.data}
            labels={result.labels}
            displayLabel={displayLabel}
            ageBand={result.ageBand}
            locale={locale}
          />

          <div className="flex flex-col gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="text-sm font-medium">{t("shareTitle")}</p>
            {revoked ? (
              <p className="text-sm text-neutral-500">{t("revoked")}</p>
            ) : (
              <>
                <p className="break-all text-sm text-neutral-600 dark:text-neutral-400">
                  {shareUrl}
                </p>
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimizable remote image
                  <img
                    src={qrDataUrl}
                    alt={t("qrCodeAlt")}
                    className="h-32 w-32"
                  />
                )}
                <p className="text-xs text-neutral-500">
                  {t("viewCount", { count: result.summary.viewCount })} ·{" "}
                  {t("expiresAt", {
                    date: new Date(result.summary.expiresAt).toLocaleString(
                      locale,
                    ),
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copyLink}
                  >
                    {t("copyLink")}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={shareUrl ?? "#"} target="_blank" rel="noreferrer">
                      {t("openLink")}
                    </a>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={revoke}
                  >
                    {t("revokeLink")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
