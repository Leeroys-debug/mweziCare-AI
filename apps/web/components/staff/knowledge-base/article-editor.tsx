"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function ArticleEditor({
  id,
  locale,
  slug,
  status,
  initialTitle,
  initialBody,
  initialReviewDue,
}: {
  id: string;
  locale: string;
  slug: string;
  status: "draft" | "approved";
  initialTitle: string;
  initialBody: string;
  initialReviewDue: string | null;
}) {
  const t = useTranslations("StaffKnowledgeBase");
  const router = useRouter();

  const [view, setView] = useState<"edit" | "preview">("edit");
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [reviewDue, setReviewDue] = useState(initialReviewDue ?? "");
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [actionState, setActionState] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");

  async function save() {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/v1/kb-documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, reviewDue: reviewDue || null }),
      });
      setSaveState(response.ok ? "success" : "error");
    } catch {
      setSaveState("error");
    }
  }

  async function approve() {
    setActionState("pending");
    try {
      const response = await fetch(`/api/v1/kb-documents/${id}/approve`, {
        method: "POST",
      });
      if (response.ok) {
        setActionState("success");
        router.refresh();
      } else {
        setActionState("error");
      }
    } catch {
      setActionState("error");
    }
  }

  async function sendBack() {
    if (!window.confirm(t("sendBackConfirm"))) return;
    setActionState("pending");
    try {
      const response = await fetch(`/api/v1/kb-documents/${id}/send-back`, {
        method: "POST",
      });
      if (response.ok) {
        setActionState("success");
        router.refresh();
      } else {
        setActionState("error");
      }
    } catch {
      setActionState("error");
    }
  }

  const paragraphs = body.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
          {t(`statusLabel.${status}`)}
        </span>
      </div>
      <p className="text-xs text-neutral-500">
        {locale} / {slug}
      </p>

      {status === "draft" && (
        <p className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          {t("draftBanner")}
        </p>
      )}

      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-900">
        <button
          type="button"
          onClick={() => setView("edit")}
          className={
            view === "edit"
              ? "min-h-[40px] flex-1 rounded-md bg-white px-3 text-sm font-medium shadow dark:bg-neutral-800"
              : "min-h-[40px] flex-1 rounded-md px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400"
          }
        >
          {t("editView")}
        </button>
        <button
          type="button"
          onClick={() => setView("preview")}
          className={
            view === "preview"
              ? "min-h-[40px] flex-1 rounded-md bg-white px-3 text-sm font-medium shadow dark:bg-neutral-800"
              : "min-h-[40px] flex-1 rounded-md px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400"
          }
        >
          {t("previewView")}
        </button>
      </div>

      {view === "edit" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            {t("titleLabel")}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("bodyLabel")}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={16}
              className="rounded-md border border-neutral-300 p-3 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("reviewDueLabel")}
            <input
              type="date"
              value={reviewDue}
              onChange={(e) => setReviewDue(e.target.value)}
              className="h-11 w-fit rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">{title}</h2>
          {paragraphs.map((p, i) => (
            <p key={i} className="text-base leading-relaxed">
              {p}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveState === "saving"}
          className="min-h-[44px] rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {saveState === "saving" ? t("saving") : t("save")}
        </button>
        {saveState === "success" && (
          <span className="text-sm text-emerald-700">{t("saveSuccess")}</span>
        )}
        {saveState === "error" && (
          <span className="text-sm text-red-600">{t("saveError")}</span>
        )}

        {status === "draft" ? (
          <button
            type="button"
            onClick={() => void approve()}
            disabled={actionState === "pending"}
            className="min-h-[44px] rounded-md border border-emerald-700 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-400"
          >
            {actionState === "pending" ? t("approving") : t("approve")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void sendBack()}
            disabled={actionState === "pending"}
            className="min-h-[44px] rounded-md border border-neutral-400 px-4 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-300"
          >
            {t("sendBack")}
          </button>
        )}
        {actionState === "success" && status === "draft" && (
          <span className="text-sm text-emerald-700">
            {t("approveSuccess")}
          </span>
        )}
        {actionState === "error" && (
          <span className="text-sm text-red-600">{t("approveError")}</span>
        )}
      </div>
    </div>
  );
}
