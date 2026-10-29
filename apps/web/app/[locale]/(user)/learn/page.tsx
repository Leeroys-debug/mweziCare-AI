import { getLocale, getTranslations } from "next-intl/server";
import { asc, eq, and } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { db } from "@/lib/server-db";
import { AskLearnSwitch } from "@/components/ask-learn-switch";
import { Link } from "@/i18n/navigation";

export default async function LearnPage() {
  const t = await getTranslations("Learn");
  const locale = await getLocale();

  const articles = await db
    .select({ slug: schema.kbDocuments.slug, title: schema.kbDocuments.title })
    .from(schema.kbDocuments)
    .where(
      and(
        eq(schema.kbDocuments.locale, locale),
        eq(schema.kbDocuments.status, "approved"),
      ),
    )
    .orderBy(asc(schema.kbDocuments.title));

  return (
    <div className="flex flex-col gap-4">
      <AskLearnSwitch />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      {articles.length === 0 ? (
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("placeholder")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {articles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/learn/${article.slug}`}
                className="block min-h-[44px] rounded-lg border border-neutral-200 px-4 py-3 text-base font-medium shadow-sm transition-all duration-150 hover:bg-emerald-50 hover:shadow-md motion-safe:active:scale-[0.98] dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                {article.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
