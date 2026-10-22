"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";

const LINKS = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/rulesets", key: "rulesets" },
  { href: "/knowledge-base", key: "knowledgeBase" },
  { href: "/facilities", key: "facilities" },
  { href: "/case-samples", key: "caseSamples" },
  { href: "/users", key: "users" },
] as const;

export function StaffNav() {
  const t = useTranslations("Staff.nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("dashboard")}
      className="flex flex-wrap gap-1 border-b border-neutral-200 pb-2 dark:border-neutral-800"
    >
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "min-h-[44px] rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white"
                : "min-h-[44px] rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }
          >
            {t(link.key)}
          </Link>
        );
      })}
    </nav>
  );
}
