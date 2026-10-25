import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@mwezicare/ui";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function LandingPage() {
  const t = useTranslations("Landing");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold text-emerald-800 dark:text-emerald-400">
          {t("title")}
        </h1>
        <p className="text-lg text-neutral-700 dark:text-neutral-300">
          {t("tagline")}
        </p>
        <p className="text-neutral-600 dark:text-neutral-400">
          {t("description")}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/sign-up">{t("signUp")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/sign-in">{t("signIn")}</Link>
        </Button>
      </div>
    </div>
  );
}
