import { getTranslations } from "next-intl/server";
import { CaseReviewActions } from "@/components/staff/case-samples/case-review-actions";
import { listCaseSamples } from "@/lib/case-samples";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

export default async function CaseSamplesPage() {
  await requireRole(["clinician"]);
  const t = await getTranslations("StaffCaseSamples");

  const samples = await listCaseSamples(db);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {t("description")}
        </p>
      </div>

      {samples.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("noSamples")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className="py-2">{t("week")}</th>
                <th className="py-2">{t("ageBand")}</th>
                <th className="py-2">{t("county")}</th>
                <th className="py-2">{t("outcome")}</th>
                <th className="py-2">{t("firedRules")}</th>
                <th className="py-2">{t("escalationReview")}</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr
                  key={sample.id}
                  className="border-b border-neutral-100 align-top dark:border-neutral-900"
                >
                  <td className="py-2">
                    {new Date(sample.week).toLocaleDateString()}
                  </td>
                  <td className="py-2">{sample.ageBand ?? t("none")}</td>
                  <td className="py-2">{sample.county ?? t("none")}</td>
                  <td className="py-2">
                    {t(`outcomeLabel.${sample.outcome}`)}
                  </td>
                  <td className="py-2">
                    {sample.firedRuleCodes &&
                    sample.firedRuleCodes.length > 0 ? (
                      <ul className="flex flex-col gap-0.5">
                        {sample.firedRuleCodes.map((code) => (
                          <li key={code} className="font-mono text-xs">
                            {code}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      t("none")
                    )}
                    {sample.features && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-emerald-700 dark:text-emerald-400">
                          {t("viewFeatures")}
                        </summary>
                        <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {JSON.stringify(sample.features, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td className="py-2">
                    {sample.outcome === "routine" ? (
                      t("none")
                    ) : (
                      <CaseReviewActions
                        assessmentId={sample.id}
                        initialVerdict={sample.review?.verdict ?? null}
                      />
                    )}
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
