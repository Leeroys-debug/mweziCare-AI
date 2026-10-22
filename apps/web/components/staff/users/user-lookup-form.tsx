"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

interface LookupResult {
  found: boolean;
  user?: {
    id: string;
    role: string;
    locale: string;
    phoneNumberVerified: boolean;
    createdAt: string;
  };
}

export function UserLookupForm() {
  const t = useTranslations("StaffUsers");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<LookupResult | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setResult(null);
    try {
      const response = await fetch("/api/v1/staff-users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = (await response.json()) as LookupResult;
      setResult(body);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("description")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="staff-user-phone">
          {t("phoneLabel")}
        </label>
        <input
          id="staff-user-phone"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder={t("phonePlaceholder")}
          className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={state === "loading" || !phoneNumber}
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {state === "loading" ? t("lookingUp") : t("lookupButton")}
        </button>
      </form>

      {state === "error" && (
        <p className="text-sm text-red-600">{t("error")}</p>
      )}

      {result && !result.found && (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("notFound")}
        </p>
      )}

      {result?.found && result.user && (
        <dl className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
          <dt className="font-medium">{t("role")}</dt>
          <dd>{result.user.role}</dd>
          <dt className="font-medium">{t("locale")}</dt>
          <dd>{result.user.locale}</dd>
          <dt className="font-medium">{t("phoneVerified")}</dt>
          <dd>{result.user.phoneNumberVerified ? t("yes") : t("no")}</dd>
          <dt className="font-medium">{t("createdAt")}</dt>
          <dd>{new Date(result.user.createdAt).toLocaleDateString()}</dd>
        </dl>
      )}
    </div>
  );
}
