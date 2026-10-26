"use client";

import { Droplet, MessageCircleHeart, NotebookPen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

function QuickAction({
  icon,
  label,
  active,
  disabled,
  ...rest
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
} & (
  { href: string; onClick?: never } | { onClick: () => void; href?: never }
)) {
  const circle = (
    <span
      className={`flex h-14 w-14 items-center justify-center rounded-full ${
        active
          ? "bg-brand-600 text-white"
          : "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
      }`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );

  const content = (
    <>
      {circle}
      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
    </>
  );

  const className =
    "flex min-w-[64px] flex-col items-center gap-1.5 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50";

  if ("href" in rest && rest.href) {
    return (
      <Link href={rest.href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={rest.onClick}
      disabled={disabled}
      className={className}
    >
      {content}
    </button>
  );
}

export function QuickActions({
  isPeriodDay,
  periodActionDisabled,
  onLogPeriod,
  onLogSymptoms,
}: {
  isPeriodDay: boolean;
  periodActionDisabled?: boolean;
  onLogPeriod: () => void;
  onLogSymptoms: () => void;
}) {
  const t = useTranslations("Track");

  return (
    <div className="flex justify-center gap-6">
      <QuickAction
        icon={<Droplet size={22} />}
        label={
          isPeriodDay
            ? t("quickActions.periodLogged")
            : t("quickActions.logPeriod")
        }
        active={isPeriodDay}
        disabled={periodActionDisabled}
        onClick={onLogPeriod}
      />
      <QuickAction
        icon={<NotebookPen size={22} />}
        label={t("quickActions.logSymptoms")}
        onClick={onLogSymptoms}
      />
      <QuickAction
        icon={<MessageCircleHeart size={22} />}
        label={t("quickActions.ask")}
        href="/assistant"
      />
    </div>
  );
}
