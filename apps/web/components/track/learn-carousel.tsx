"use client";

import { BookOpen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";

interface LearnArticle {
  slug: string;
  title: string;
}

// Alternating soft tints from the existing brand scale — not a rainbow of
// new colors, just enough variation that the row doesn't read as one flat
// block, echoing the card-carousel pattern without inventing a new palette.
const CARD_TINTS = [
  "bg-brand-50 dark:bg-brand-950",
  "bg-amber-50 dark:bg-amber-950",
  "bg-brand-100 dark:bg-brand-900",
];

export function LearnCarousel() {
  const t = useTranslations("Track");
  const locale = useLocale();

  const { data } = useQuery({
    queryKey: ["learn-articles", locale],
    queryFn: async (): Promise<LearnArticle[]> => {
      const response = await fetch(`/api/v1/learn-articles?locale=${locale}`);
      if (!response.ok) throw new Error("Failed to load articles");
      const body = (await response.json()) as { articles: LearnArticle[] };
      return body.articles;
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
        {t("learnCarouselTitle")}
      </h2>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {data.map((article, i) => (
          <Link
            key={article.slug}
            href={`/learn/${article.slug}`}
            className={`flex min-h-[112px] w-36 shrink-0 snap-start flex-col justify-between rounded-xl p-3 shadow-sm transition-all duration-150 hover:shadow-md motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95 ${CARD_TINTS[i % CARD_TINTS.length]}`}
          >
            <BookOpen
              size={18}
              className="text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              {article.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
