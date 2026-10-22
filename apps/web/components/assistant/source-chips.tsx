"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export interface SourceRef {
  slug: string;
  title?: string;
  status?: string;
}

/** Source chips link to the article's Learn page — content/{locale}/*.md via clinical.kb_documents. */
export function SourceChips({ sources }: { sources: (SourceRef | string)[] }) {
  const t = useTranslations("Assistant");
  if (sources.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {t("sourcesLabel")}
      </span>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const ref: SourceRef =
            typeof source === "string" ? { slug: source } : source;
          return (
            <Link
              key={ref.slug}
              href={`/learn/${ref.slug}`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-emerald-700 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-neutral-900"
            >
              {ref.title ?? ref.slug}
              {ref.status === "draft" && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                  {t("draftBadge")}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
