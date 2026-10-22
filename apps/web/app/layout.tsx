import type { Metadata } from "next";
import { headers } from "next/headers";
import { routing } from "@/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: "MweziCare AI",
  description: "Understand your cycle. Recognize the signs. Get care sooner.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Routes outside /[locale] (api/v1, /s/[token]) render through this
  // layout without a locale param, so read the locale next-intl's
  // middleware resolved for this request to set <html lang> correctly.
  const headerList = await headers();
  const locale = headerList.get("X-NEXT-INTL-LOCALE") ?? routing.defaultLocale;

  return (
    <html lang={locale}>
      <body className="min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
