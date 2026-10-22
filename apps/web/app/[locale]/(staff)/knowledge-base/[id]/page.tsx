import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { schema } from "@mwezicare/db";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { ArticleEditor } from "@/components/staff/knowledge-base/article-editor";

export default async function KnowledgeBaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["clinician", "programme_admin", "system_admin"]);
  const t = await getTranslations("StaffKnowledgeBase");

  const { id } = await params;
  const [document] = await db
    .select()
    .from(schema.kbDocuments)
    .where(eq(schema.kbDocuments.id, id));
  if (!document) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/knowledge-base"
        className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
      >
        {t("backToList")}
      </Link>
      <ArticleEditor
        id={document.id}
        locale={document.locale}
        slug={document.slug}
        status={document.status}
        initialTitle={document.title}
        initialBody={document.body}
        initialReviewDue={document.reviewDue}
      />
    </div>
  );
}
