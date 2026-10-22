"use client";

import { useTranslations } from "next-intl";

export function ClearHistoryButton({
  disabled,
  onClear,
}: {
  disabled?: boolean;
  onClear: () => void;
}) {
  const t = useTranslations("Assistant");

  function handleClick() {
    if (window.confirm(t("clearHistoryConfirm"))) {
      onClear();
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className="min-h-[44px] rounded-md px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
    >
      {t("clearHistory")}
    </button>
  );
}
