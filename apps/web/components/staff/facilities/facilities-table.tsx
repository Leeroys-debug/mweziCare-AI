"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

interface StaffFacilityRow {
  id: string;
  name: string;
  county: string;
  status: "listed" | "verified" | "unavailable";
  lastVerifiedAt: string | null;
  dueForReverification: boolean;
}

export function FacilitiesTable() {
  const t = useTranslations("StaffFacilities");
  const [county, setCounty] = useState("");
  const [status, setStatus] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [facilities, setFacilities] = useState<StaffFacilityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (county) params.set("county", county);
    if (status) params.set("status", status);
    if (dueOnly) params.set("dueForReverification", "1");

    (async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/v1/staff-facilities?${params.toString()}`,
        );
        const body = (await response.json()) as {
          facilities: StaffFacilityRow[];
        };
        setFacilities(body.facilities);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [county, status, dueOnly]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          {t("countyFilterLabel")}
          <input
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder={t("countyFilterPlaceholder")}
            className="h-10 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("statusFilterLabel")}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="">{t("statusAll")}</option>
            <option value="listed">{t("statusLabel.listed")}</option>
            <option value="verified">{t("statusLabel.verified")}</option>
            <option value="unavailable">{t("statusLabel.unavailable")}</option>
          </select>
        </label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={dueOnly}
            onChange={(e) => setDueOnly(e.target.checked)}
            className="h-5 w-5"
          />
          {t("dueFilterLabel")}
        </label>
      </div>

      {isLoading ? null : facilities.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("noResults")}
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
              <th className="py-2">{t("name")}</th>
              <th className="py-2">{t("county")}</th>
              <th className="py-2">{t("status")}</th>
              <th className="py-2">{t("lastVerified")}</th>
            </tr>
          </thead>
          <tbody>
            {facilities.map((f) => (
              <tr
                key={f.id}
                className="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td className="py-2">
                  <Link
                    href={`/facilities/${f.id}`}
                    className="font-medium text-emerald-700 dark:text-emerald-400"
                  >
                    {f.name}
                  </Link>
                </td>
                <td className="py-2">{f.county}</td>
                <td className="py-2">{t(`statusLabel.${f.status}`)}</td>
                <td
                  className={
                    f.dueForReverification
                      ? "py-2 font-semibold text-red-600"
                      : "py-2"
                  }
                >
                  {f.lastVerifiedAt
                    ? new Date(f.lastVerifiedAt).toLocaleDateString()
                    : t("never")}
                  {f.dueForReverification && ` (${t("dueBadge")})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
