import { getTranslations } from "next-intl/server";
import { listRulesetVersions } from "@mwezicare/db";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { NewDraftButton } from "@/components/staff/rulesets/new-draft-button";

export default async function RulesetsListPage() {
  await requireRole(["clinician", "programme_admin", "system_admin"]);
  const t = await getTranslations("StaffRulesets");

  const versions = await listRulesetVersions(db);
  const latest = versions[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <NewDraftButton latestVersion={latest?.version ?? null} />
      </div>

      {versions.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("noVersions")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className="py-2">{t("version")}</th>
                <th className="py-2">{t("status")}</th>
                <th className="py-2">{t("approvedBy")}</th>
                <th className="py-2">{t("createdAt")}</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-neutral-100 dark:border-neutral-900"
                >
                  <td className="py-2">
                    <Link
                      href={`/rulesets/${v.version}`}
                      className="font-medium text-emerald-700 dark:text-emerald-400"
                    >
                      {v.version}
                    </Link>
                  </td>
                  <td className="py-2">{t(`statusLabel.${v.status}`)}</td>
                  <td className="py-2">{v.approvedByName ?? "—"}</td>
                  <td className="py-2">
                    {new Date(v.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
