import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("Privacy");
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        {t("placeholder")}
      </p>
    </div>
  );
}
