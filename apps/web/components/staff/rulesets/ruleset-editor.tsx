"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ruleSchema,
  type Rule,
  type RulesetStatus,
} from "@mwezicare/rules-engine";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";

const rulesArraySchema = z.array(ruleSchema).min(1);

interface FixtureResult {
  id: string;
  description: string;
  expectedOutcome: string;
  actualOutcome: string;
  pass: boolean;
}

type DiffStatus = "added" | "removed" | "changed" | "unchanged";

function diffRules(current: Rule[], previous: Rule[] | null) {
  if (!previous) return null;
  const previousById = new Map(previous.map((r) => [r.id, r]));
  const currentById = new Map(current.map((r) => [r.id, r]));
  const ids = new Set([...previousById.keys(), ...currentById.keys()]);

  return [...ids].map((id) => {
    const before = previousById.get(id) ?? null;
    const after = currentById.get(id) ?? null;
    let status: DiffStatus;
    if (!before) status = "added";
    else if (!after) status = "removed";
    else
      status =
        JSON.stringify(before) === JSON.stringify(after)
          ? "unchanged"
          : "changed";
    return { id, before, after, status };
  });
}

export function RulesetEditor({
  version,
  status,
  rules: initialRules,
  previousRules,
}: {
  version: number;
  status: RulesetStatus;
  rules: Rule[];
  previousRules: Rule[] | null;
}) {
  const t = useTranslations("StaffRulesets");
  const router = useRouter();
  const isDraft = status === "draft";

  const [view, setView] = useState<"json" | "form" | "diff">("json");
  const [rulesText, setRulesText] = useState(() =>
    JSON.stringify(initialRules, null, 2),
  );
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [fixtureResults, setFixtureResults] = useState<FixtureResult[] | null>(
    null,
  );
  const [isRunningFixtures, setIsRunningFixtures] = useState(false);

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [approveName, setApproveName] = useState("");
  const [approveState, setApproveState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  const diff = useMemo(
    () => diffRules(rules, previousRules),
    [rules, previousRules],
  );
  const diffStatusLabel: Record<DiffStatus, string> = {
    added: t("diffAdded"),
    removed: t("diffRemoved"),
    changed: t("diffChanged"),
    unchanged: t("diffUnchanged"),
  };

  function syncFromJson(): Rule[] | null {
    try {
      const parsed = JSON.parse(rulesText);
      const result = rulesArraySchema.safeParse(parsed);
      if (!result.success) {
        setJsonError(result.error.issues[0]?.message ?? "Invalid rules");
        return null;
      }
      setJsonError(null);
      setRules(result.data);
      return result.data;
    } catch {
      setJsonError("Invalid JSON");
      return null;
    }
  }

  function updateRule(index: number, patch: Partial<Rule>) {
    const next = rules.map((r, i) => (i === index ? { ...r, ...patch } : r));
    setRules(next);
    setRulesText(JSON.stringify(next, null, 2));
  }

  async function runFixtures() {
    setIsRunningFixtures(true);
    const candidateRules = view === "json" ? syncFromJson() : rules;
    if (!candidateRules) {
      setIsRunningFixtures(false);
      return;
    }
    try {
      const response = await fetch("/api/v1/rulesets/run-fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, rules: candidateRules }),
      });
      if (response.ok) {
        const body = (await response.json()) as { results: FixtureResult[] };
        setFixtureResults(body.results);
      }
    } finally {
      setIsRunningFixtures(false);
    }
  }

  async function save() {
    const candidateRules = view === "json" ? syncFromJson() : rules;
    if (!candidateRules) return;
    setSaveState("saving");
    try {
      const response = await fetch(`/api/v1/rulesets/${version}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: candidateRules }),
      });
      setSaveState(response.ok ? "success" : "error");
    } catch {
      setSaveState("error");
    }
  }

  async function approve() {
    if (!window.confirm(t("approveConfirm"))) return;
    setApproveState("pending");
    try {
      const response = await fetch(`/api/v1/rulesets/${version}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicianName: approveName }),
      });
      if (response.ok) {
        setApproveState("success");
        router.refresh();
      } else {
        setApproveState("error");
      }
    } catch {
      setApproveState("error");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t("version")} {version} — {t(`statusLabel.${status}`)}
        </h1>
      </div>

      {!isDraft && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          {t("readOnlyNotice")}
        </p>
      )}

      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
        {(["json", "form", "diff"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={
              view === v
                ? "min-h-[40px] flex-1 rounded-md bg-white px-3 text-sm font-medium shadow dark:bg-neutral-800"
                : "min-h-[40px] flex-1 rounded-md px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400"
            }
          >
            {v === "json"
              ? t("jsonView")
              : v === "form"
                ? t("formView")
                : t("diffView")}
          </button>
        ))}
      </div>

      {view === "json" && (
        <div className="flex flex-col gap-1">
          <textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            disabled={!isDraft}
            spellCheck={false}
            rows={20}
            className="w-full rounded-md border border-neutral-300 p-3 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
          />
          {jsonError && <p className="text-sm text-red-600">{jsonError}</p>}
        </div>
      )}

      {view === "form" && (
        <div className="flex flex-col gap-3">
          {rules.map((rule, i) => (
            <div
              key={rule.id}
              className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <p className="font-mono text-xs text-neutral-500">{rule.id}</p>
              <label className="flex flex-col gap-1 text-sm">
                {t("priority")}
                <input
                  type="number"
                  value={rule.priority}
                  disabled={!isDraft}
                  onChange={(e) =>
                    updateRule(i, { priority: Number(e.target.value) })
                  }
                  className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("outcome")}
                <select
                  value={rule.outcome}
                  disabled={!isDraft}
                  onChange={(e) =>
                    updateRule(i, {
                      outcome: e.target.value as Rule["outcome"],
                    })
                  }
                  className="h-10 rounded-md border border-neutral-300 px-2 dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="routine">routine</option>
                  <option value="assess_soon">assess_soon</option>
                  <option value="urgent">urgent</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("reasonEn")}
                <textarea
                  value={rule.reason.en}
                  disabled={!isDraft}
                  onChange={(e) =>
                    updateRule(i, {
                      reason: { ...rule.reason, en: e.target.value },
                    })
                  }
                  className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("reasonSw")}
                <textarea
                  value={rule.reason.sw}
                  disabled={!isDraft}
                  onChange={(e) =>
                    updateRule(i, {
                      reason: { ...rule.reason, sw: e.target.value },
                    })
                  }
                  className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("clinicianNote")}
                <textarea
                  value={rule.clinicianNote}
                  disabled={!isDraft}
                  onChange={(e) =>
                    updateRule(i, { clinicianNote: e.target.value })
                  }
                  className="rounded-md border border-neutral-300 p-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("conditions")}
                <textarea
                  value={JSON.stringify(rule.conditions)}
                  disabled={!isDraft}
                  onChange={(e) => {
                    try {
                      updateRule(i, { conditions: JSON.parse(e.target.value) });
                    } catch {
                      // Ignore until it's valid JSON again — rawtext is still visible to edit.
                    }
                  }}
                  className="rounded-md border border-neutral-300 p-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {view === "diff" && (
        <div className="flex flex-col gap-2">
          {!diff ? (
            <p className="text-sm text-neutral-500">{t("noPreviousVersion")}</p>
          ) : (
            diff.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800"
              >
                <p className="font-mono font-semibold">
                  {entry.id} —{" "}
                  <span
                    className={
                      entry.status === "added"
                        ? "text-emerald-700"
                        : entry.status === "removed"
                          ? "text-red-600"
                          : entry.status === "changed"
                            ? "text-amber-700"
                            : "text-neutral-500"
                    }
                  >
                    {diffStatusLabel[entry.status]}
                  </span>
                </p>
                {entry.status === "changed" && (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(entry.before, null, 2)}
                    </pre>
                    <pre className="overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(entry.after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runFixtures()}
          disabled={isRunningFixtures}
          className="min-h-[44px] rounded-md border border-emerald-700 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-400"
        >
          {isRunningFixtures ? t("runningFixtures") : t("runFixtures")}
        </button>
        {fixtureResults && (
          <span className="text-sm">
            {t("fixtureResults", {
              pass: fixtureResults.filter((r) => r.pass).length,
              total: fixtureResults.length,
            })}
          </span>
        )}

        {isDraft && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState === "saving"}
            className="min-h-[44px] rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {saveState === "saving" ? t("saving") : t("save")}
          </button>
        )}
        {saveState === "success" && (
          <span className="text-sm text-emerald-700">{t("saveSuccess")}</span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-600">{t("saveError")}</span>
        )}
      </div>

      {fixtureResults && fixtureResults.some((r) => !r.pass) && (
        <ul className="flex flex-col gap-1 text-xs text-red-600">
          {fixtureResults
            .filter((r) => !r.pass)
            .map((r) => (
              <li key={r.id}>
                {r.id}: expected {r.expectedOutcome}, got {r.actualOutcome}
              </li>
            ))}
        </ul>
      )}

      {isDraft && (
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="font-semibold">{t("approveTitle")}</h2>
          <label className="flex flex-col gap-1 text-sm">
            {t("approveNameLabel")}
            <input
              value={approveName}
              onChange={(e) => setApproveName(e.target.value)}
              placeholder={t("approveNamePlaceholder")}
              className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <button
            type="button"
            disabled={
              approveName.trim().length < 2 || approveState === "pending"
            }
            onClick={() => void approve()}
            className="min-h-[44px] w-fit rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {t("approveButton")}
          </button>
        </div>
      )}
      {approveState === "success" && (
        <p className="text-sm text-emerald-700">{t("approveSuccess")}</p>
      )}
      {approveState === "error" && (
        <p className="text-sm text-red-600">{t("approveError")}</p>
      )}
    </div>
  );
}
