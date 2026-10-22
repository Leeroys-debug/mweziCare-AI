import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getRulesetMeta, loadRulesetByVersion } from "@mwezicare/db";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { RulesetEditor } from "@/components/staff/rulesets/ruleset-editor";

export default async function RulesetDetailPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  await requireRole(["clinician", "programme_admin", "system_admin"]);
  const t = await getTranslations("StaffRulesets");

  const { version: versionParam } = await params;
  const version = Number(versionParam);
  if (!Number.isInteger(version) || version <= 0) notFound();

  const [ruleset, meta, previousRuleset] = await Promise.all([
    loadRulesetByVersion(db, version),
    getRulesetMeta(db, version),
    loadRulesetByVersion(db, version - 1),
  ]);
  if (!ruleset || !meta) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/rulesets"
        className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        {t("backToList")}
      </Link>
      <RulesetEditor
        version={ruleset.version}
        status={ruleset.status}
        rules={ruleset.rules}
        previousRules={previousRuleset?.rules ?? null}
      />
    </div>
  );
}
