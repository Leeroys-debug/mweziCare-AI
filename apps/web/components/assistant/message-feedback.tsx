"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function MessageFeedback({ messageId }: { messageId?: string }) {
  const t = useTranslations("Assistant");
  const [sent, setSent] = useState<"up" | "down" | null>(null);

  if (!messageId) return null;

  async function send(feedback: "up" | "down") {
    setSent(feedback);
    try {
      await fetch("/api/v1/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, feedback }),
      });
    } catch {
      // Best-effort — feedback isn't critical path, don't block the UI on it.
    }
  }

  if (sent) {
    return (
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {t("feedbackThanks")}
      </p>
    );
  }

  return (
    <div className="flex gap-1">
      <button
        type="button"
        aria-label={t("thumbsUp")}
        onClick={() => send("up")}
        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-base hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        👍
      </button>
      <button
        type="button"
        aria-label={t("thumbsDown")}
        onClick={() => send("down")}
        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-md text-base hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        👎
      </button>
    </div>
  );
}
