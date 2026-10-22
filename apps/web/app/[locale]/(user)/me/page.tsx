import { getTranslations } from "next-intl/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@mwezicare/db";
import { getCurrentUser } from "@/lib/rbac";
import { db } from "@/lib/server-db";
import { LanguageSwitcher } from "@/components/language-switcher";
import { MeAccount, type ConsentRow } from "@/components/me-account";

const PURPOSES: ConsentRow["purpose"][] = [
  "tracking",
  "location",
  "research",
  "sharing",
];

export default async function MePage() {
  const t = await getTranslations("Me");
  const user = await getCurrentUser();

  const consents: ConsentRow[] = [];
  if (user) {
    for (const purpose of PURPOSES) {
      const [active] = await db
        .select()
        .from(schema.consents)
        .where(
          and(
            eq(schema.consents.userId, user.id),
            eq(schema.consents.purpose, purpose),
            isNull(schema.consents.withdrawnAt),
          ),
        )
        .orderBy(desc(schema.consents.version))
        .limit(1);
      consents.push({ purpose, granted: Boolean(active) });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <LanguageSwitcher />
      {user && <MeAccount consents={consents} />}
    </div>
  );
}
