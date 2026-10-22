"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";

const AGE_BANDS = ["13-15", "16-17", "18-20", "21-24", "25+"] as const;
const MINOR_AGE_BANDS = new Set(["13-15", "16-17"]);

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const router = useRouter();
  const [ageBand, setAgeBand] = useState("");
  const [county, setCounty] = useState("");
  const [consentLocation, setConsentLocation] = useState(false);
  const [consentResearch, setConsentResearch] = useState(false);
  const [consentSharing, setConsentSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isMinor = MINOR_AGE_BANDS.has(ageBand);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isMinor) return;
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/v1/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ageBand,
          county,
          consents: {
            tracking: true,
            location: consentLocation,
            research: consentResearch,
            sharing: consentSharing,
          },
        }),
      });
      if (!response.ok) {
        setError(t("error"));
        return;
      }
      router.push("/quiz?kind=onboarding");
      router.refresh();
    } catch {
      setError(t("error"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("ageBandLabel")}
        <select
          required
          value={ageBand}
          onChange={(event) => setAgeBand(event.target.value)}
          className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            {t("ageBandPlaceholder")}
          </option>
          {AGE_BANDS.map((band) => (
            <option key={band} value={band}>
              {band}
            </option>
          ))}
        </select>
      </label>

      {isMinor ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            {t("minorTitle")}
          </h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {t("minorBody")}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("countyLabel")}
            <input
              type="text"
              required
              placeholder={t("countyPlaceholder")}
              value={county}
              onChange={(event) => setCounty(event.target.value)}
              className="h-12 rounded-md border border-neutral-300 px-3 text-base dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">
              {t("consentsTitle")}
            </legend>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                {t("consentTracking")}{" "}
                <span className="text-neutral-500">
                  ({t("consentTrackingRequired")})
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentLocation}
                onChange={(event) => setConsentLocation(event.target.checked)}
                className="mt-1"
              />
              {t("consentLocation")}
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentResearch}
                onChange={(event) => setConsentResearch(event.target.checked)}
                className="mt-1"
              />
              {t("consentResearch")}
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentSharing}
                onChange={(event) => setConsentSharing(event.target.checked)}
                className="mt-1"
              />
              {t("consentSharing")}
            </label>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" size="lg" disabled={pending}>
            {t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
