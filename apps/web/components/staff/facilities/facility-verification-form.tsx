"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { CallScript } from "@mwezicare/facilities";

export function FacilityVerificationForm({
  facilityId,
  existingNotes,
  existingCallScript,
}: {
  facilityId: string;
  existingNotes: string | null;
  existingCallScript: CallScript | null;
}) {
  const t = useTranslations("StaffFacilities");
  const router = useRouter();

  const [phoneConfirmed, setPhoneConfirmed] = useState(
    existingCallScript?.phoneConfirmed ?? false,
  );
  const [gynAvailable, setGynAvailable] = useState(
    existingCallScript?.gynAvailable ?? false,
  );
  const [daysHours, setDaysHours] = useState(
    existingCallScript?.daysHours ?? "",
  );
  const [referralNeeded, setReferralNeeded] = useState(
    existingCallScript?.referralNeeded ?? false,
  );
  const [costInfo, setCostInfo] = useState(existingCallScript?.costInfo ?? "");
  const [notes, setNotes] = useState(existingNotes ?? "");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  async function submit(status: "verified" | "unavailable") {
    setSaveState("saving");
    try {
      const response = await fetch(
        `/api/v1/staff-facilities/${facilityId}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            notes,
            callScript: {
              phoneConfirmed,
              gynAvailable,
              daysHours,
              referralNeeded,
              costInfo,
            },
          }),
        },
      );
      if (response.ok) {
        setSaveState("success");
        router.refresh();
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="font-semibold">{t("callScriptTitle")}</h2>

      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={phoneConfirmed}
          onChange={(e) => setPhoneConfirmed(e.target.checked)}
          className="h-5 w-5"
        />
        {t("phoneConfirmed")}
      </label>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={gynAvailable}
          onChange={(e) => setGynAvailable(e.target.checked)}
          className="h-5 w-5"
        />
        {t("gynAvailable")}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("daysHoursLabel")}
        <input
          value={daysHours}
          onChange={(e) => setDaysHours(e.target.value)}
          placeholder={t("daysHoursPlaceholder")}
          className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={referralNeeded}
          onChange={(e) => setReferralNeeded(e.target.checked)}
          className="h-5 w-5"
        />
        {t("referralNeeded")}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("costInfoLabel")}
        <input
          value={costInfo}
          onChange={(e) => setCostInfo(e.target.value)}
          placeholder={t("costInfoPlaceholder")}
          className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {t("notesLabel")}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notesPlaceholder")}
          rows={4}
          className="rounded-md border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={saveState === "saving"}
          onClick={() => void submit("verified")}
          className="min-h-[44px] rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saveState === "saving" ? t("saving") : t("markVerified")}
        </button>
        <button
          type="button"
          disabled={saveState === "saving"}
          onClick={() => void submit("unavailable")}
          className="min-h-[44px] rounded-md border border-red-600 px-4 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400"
        >
          {saveState === "saving" ? t("saving") : t("markUnavailable")}
        </button>
        {saveState === "success" && (
          <span className="text-sm text-emerald-700">{t("saveSuccess")}</span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-600">{t("saveError")}</span>
        )}
      </div>
    </div>
  );
}
