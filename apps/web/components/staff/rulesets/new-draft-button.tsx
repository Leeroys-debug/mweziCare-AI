"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

interface RuleResponse {
  ruleset: { rules: unknown[] };
}

export function NewDraftButton({
  latestVersion,
}: {
  latestVersion: number | null;
}) {
  const t = useTranslations("StaffRulesets");
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function createDraft() {
    setIsCreating(true);
    try {
      let rules: unknown[] = [];
      if (latestVersion !== null) {
        const response = await fetch(`/api/v1/rulesets/${latestVersion}`);
        if (response.ok) {
          const body = (await response.json()) as RuleResponse;
          rules = body.ruleset.rules;
        }
      }

      const created = await fetch("/api/v1/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (created.ok) {
        const body = (await created.json()) as { ruleset: { version: number } };
        router.push(`/rulesets/${body.ruleset.version}`);
      }
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isCreating || latestVersion === null}
      onClick={() => void createDraft()}
      className="min-h-[44px] rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
    >
      {t("newDraft")}
    </button>
  );
}
