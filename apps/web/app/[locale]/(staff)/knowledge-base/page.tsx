import { asc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { schema } from "@mwezicare/db";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";

export default async function KnowledgeBaseListPage() {
  await requireRole(["clinician", "programme_admin", "system_admin"]);
  const t = await getTranslations("StaffKnowledgeBase");

  const documents = await db
    .select({
      id: schema.kbDocuments.id,
      locale: schema.kbDocuments.locale,
      title: schema.kbDocuments.title,
      status: schema.kbDocuments.status,
      reviewDue: schema.kbDocuments.reviewDue,
    })
    .from(schema.kbDocuments)
    .orderBy(asc(schema.kbDocuments.locale), asc(schema.kbDocuments.title));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {documents.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("noArticles")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left dark:border-neutral-800">
                <th className="py-2">{t("articleTitle")}</th>
                <th className="py-2">{t("locale")}</th>
                <th className="py-2">{t("status")}</th>
                <th className="py-2">{t("reviewDue")}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const isOverdue = Boolean(
                  doc.reviewDue && doc.reviewDue < today,
                );
                return (
                  <tr
                    key={doc.id}
                    className="border-b border-neutral-100 dark:border-neutral-900"
                  >
                    <td className="py-2">
                      <Link
                        href={`/knowledge-base/${doc.id}`}
                        className="font-medium text-emerald-700 dark:text-emerald-400"
                      >
                        {doc.title}
                      </Link>
                    </td>
                    <td className="py-2">{doc.locale}</td>
                    <td className="py-2">{t(`statusLabel.${doc.status}`)}</td>
                    <td
                      className={
                        isOverdue ? "py-2 font-semibold text-red-600" : "py-2"
                      }
                    >
                      {doc.reviewDue ?? "—"}
                      {isOverdue && ` (${t("overdue")})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
