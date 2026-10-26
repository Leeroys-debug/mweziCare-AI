"use client";

import { useTranslations } from "next-intl";
import { FacilityCard, type FacilityCardData } from "./facility-card";

export function FacilityList({
  results,
  outcome,
}: {
  results: FacilityCardData[];
  outcome?: "routine" | "assess_soon" | "urgent";
}) {
  const t = useTranslations("Care");
  const hasVerifiedGyn = results.some((f) =>
    f.services.some((s) => s.serviceCode === "GYN" && s.status === "verified"),
  );

  return (
    <div className="flex flex-col gap-3">
      {!hasVerifiedGyn && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          {t("noVerifiedFallback")}
        </div>
      )}
      {results.length === 0 ? (
        <p className="text-sm text-neutral-500">{t("noResults")}</p>
      ) : (
        results.map((facility) => (
          <FacilityCard
            key={facility.id}
            facility={facility}
            outcome={outcome}
          />
        ))
      )}
    </div>
  );
}
