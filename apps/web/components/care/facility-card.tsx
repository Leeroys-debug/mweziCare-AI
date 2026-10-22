"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Chip } from "@mwezicare/ui";

export interface FacilityCardData {
  id: string;
  name: string;
  county: string;
  subCounty: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  distanceMeters: number | null;
  services: {
    serviceCode: string;
    status: "listed" | "verified" | "unavailable";
    lastVerifiedAt: string | null;
  }[];
}

const SIX_MONTHS_MS = 182 * 24 * 60 * 60 * 1000;

function gynStatus(facility: FacilityCardData) {
  const gyn = facility.services.find((s) => s.serviceCode === "GYN");
  if (gyn?.status === "verified" && gyn.lastVerifiedAt) {
    const verifiedAt = new Date(gyn.lastVerifiedAt);
    return {
      verified: true as const,
      date: verifiedAt,
      stale: Date.now() - verifiedAt.getTime() > SIX_MONTHS_MS,
    };
  }
  return { verified: false as const };
}

function formatDistance(metres: number | null): string | null {
  if (metres == null) return null;
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

export function FacilityCard({
  facility,
  outcome,
}: {
  facility: FacilityCardData;
  outcome?: "routine" | "assess_soon" | "urgent";
}) {
  const t = useTranslations("Care");
  const [followUpConsent, setFollowUpConsent] = useState(false);
  const [referred, setReferred] = useState(false);
  const status = gynStatus(facility);
  const distance = formatDistance(facility.distanceMeters);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${facility.lat},${facility.lng}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${facility.lat}&mlon=${facility.lng}#map=16/${facility.lat}/${facility.lng}`;

  async function recordReferral() {
    await fetch("/api/v1/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        facilityId: facility.id,
        followUpConsent,
        outcome,
      }),
    });
    setReferred(true);
  }

  async function share() {
    const shareData = {
      title: facility.name,
      text: facility.phone ?? undefined,
      url: googleMapsUrl,
    };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else {
      await navigator.clipboard.writeText(
        `${facility.name} — ${googleMapsUrl}`,
      );
    }
  }

  return (
    <div
      data-testid="facility-card"
      data-facility-id={facility.id}
      className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{facility.name}</p>
          <p className="text-xs text-neutral-500">
            {facility.subCounty ? `${facility.subCounty}, ` : ""}
            {facility.county}
            {distance ? ` · ${distance}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {status.verified ? (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            {t("gynConfirmedOn", {
              date: status.date.toISOString().slice(0, 10),
            })}
          </span>
        ) : (
          <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {t("gynNotConfirmed")}
          </span>
        )}
        {status.verified && status.stale && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            {t("mayBeOutOfDate")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {facility.phone && (
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${facility.phone}`}>{t("call")}</a>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <a href={googleMapsUrl} target="_blank" rel="noreferrer">
            {t("directionsGoogle")}
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={osmUrl} target="_blank" rel="noreferrer">
            {t("directionsOsm")}
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={share}>
          {t("share")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <Chip
          selected={followUpConsent}
          onClick={() => setFollowUpConsent((v) => !v)}
        >
          {t("followUpConsent")}
        </Chip>
        <Button
          type="button"
          size="sm"
          onClick={recordReferral}
          disabled={referred}
        >
          {referred ? t("contactedRecorded") : t("iContactedThisFacility")}
        </Button>
      </div>
    </div>
  );
}
