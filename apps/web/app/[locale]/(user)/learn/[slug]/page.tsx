import { and, eq } from "drizzle-orm";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { schema } from "@mwezicare/db";
import { db } from "@/lib/server-db";
import { AskLearnSwitch } from "@/components/ask-learn-switch";
import { Link } from "@/i18n/navigation";

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("Learn");
  const locale = await getLocale();

  const [article] = await db
    .select()
    .from(schema.kbDocuments)
    .where(
      and(
        eq(schema.kbDocuments.locale, locale),
        eq(schema.kbDocuments.slug, slug),
      ),
    );

  if (!article) notFound();

  const paragraphs = article.body.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <AskLearnSwitch />

      <Link href="/learn" className="text-sm font-medium text-emerald-700">
        {t("backToList")}
      </Link>

      {article.status === "draft" && (
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          {t("draftBadge")}
        </span>
      )}

      <h1 className="text-2xl font-semibold">{article.title}</h1>

      <div className="flex flex-col gap-3 text-base leading-relaxed">
        {paragraphs.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      {article.reviewDue && (
        <p className="text-xs text-neutral-500">
          {t("reviewDueLabel")}: {article.reviewDue}
        </p>
      )}
    </div>
  );
}
