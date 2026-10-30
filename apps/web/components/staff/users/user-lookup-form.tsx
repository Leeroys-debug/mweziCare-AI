"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const ASSIGNABLE_ROLES = [
  "user",
  "clinician",
  "verifier",
  "programme_admin",
  "system_admin",
] as const;

interface LookupResult {
  found: boolean;
  user?: {
    id: string;
    role: string;
    locale: string;
    emailVerified: boolean;
    createdAt: string;
  };
}

export function UserLookupForm() {
  const t = useTranslations("StaffUsers");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [roleDraft, setRoleDraft] = useState("");
  const [roleUpdateState, setRoleUpdateState] = useState<
    "idle" | "updating" | "success" | "error"
  >("idle");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("loading");
    setResult(null);
    setRoleUpdateState("idle");
    try {
      const response = await fetch("/api/v1/staff-users/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      const body = (await response.json()) as LookupResult;
      setResult(body);
      setRoleDraft(body.user?.role ?? "");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function handleRoleUpdate() {
    if (!result?.user) return;
    setRoleUpdateState("updating");
    try {
      const response = await fetch(
        `/api/v1/staff-users/${result.user.id}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: roleDraft }),
        },
      );
      if (!response.ok) {
        setRoleUpdateState("error");
        return;
      }
      setResult((prev) =>
        prev?.user
          ? { ...prev, user: { ...prev.user, role: roleDraft } }
          : prev,
      );
      setRoleUpdateState("success");
    } catch {
      setRoleUpdateState("error");
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
        <label className="sr-only" htmlFor="staff-user-email">
          {t("emailLabel")}
        </label>
        <input
          id="staff-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={state === "loading" || !email}
          className="h-11 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
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
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            <dt className="font-medium">{t("role")}</dt>
            <dd>{result.user.role}</dd>
            <dt className="font-medium">{t("locale")}</dt>
            <dd>{result.user.locale}</dd>
            <dt className="font-medium">{t("emailVerified")}</dt>
            <dd>{result.user.emailVerified ? t("yes") : t("no")}</dd>
            <dt className="font-medium">{t("createdAt")}</dt>
            <dd>{new Date(result.user.createdAt).toLocaleDateString()}</dd>
          </dl>

          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <label htmlFor="staff-user-role" className="text-sm font-medium">
              {t("changeRoleLabel")}
            </label>
            <div className="flex gap-2">
              <select
                id="staff-user-role"
                value={roleDraft}
                onChange={(e) => setRoleDraft(e.target.value)}
                className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleRoleUpdate()}
                disabled={
                  roleUpdateState === "updating" ||
                  roleDraft === result.user.role
                }
                className="h-11 rounded-md bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
              >
                {roleUpdateState === "updating"
                  ? t("updatingRole")
                  : t("updateRoleButton")}
              </button>
            </div>
            {roleUpdateState === "success" && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {t("updateRoleSuccess")}
              </p>
            )}
            {roleUpdateState === "error" && (
              <p className="text-sm text-red-600">{t("updateRoleError")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
