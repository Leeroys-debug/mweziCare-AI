"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ClearHistoryButton } from "./clear-history-button";
import { MessageFeedback } from "./message-feedback";
import { SourceChips, type SourceRef } from "./source-chips";
import { StarterQuestions } from "./starter-questions";

const SESSION_STORAGE_KEY = "mwezicare.chat.sessionId";

interface ChatMessageVM {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: (SourceRef | string)[];
  pending?: boolean;
}

interface HistoryResponse {
  messages: {
    id: string;
    role: "user" | "assistant";
    content: string;
    sources: string[];
  }[];
}

/** Parses the `data: {...}\n\n` chunks emitted by POST /api/v1/chat. */
async function* readSseEvents(
  response: Response,
): AsyncGenerator<Record<string, unknown>> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex: number;
    while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      if (chunk.startsWith("data: ")) {
        yield JSON.parse(chunk.slice("data: ".length));
      }
    }
  }
}

export function ChatThread() {
  const t = useTranslations("Assistant");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageVM[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.localStorage.getItem(SESSION_STORAGE_KEY)),
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedSessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!storedSessionId) return;

    (async () => {
      try {
        const response = await fetch(
          `/api/v1/chat?sessionId=${storedSessionId}`,
        );
        if (!response.ok) throw new Error("Failed to load history");
        const body = (await response.json()) as HistoryResponse;
        setMessages(
          body.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            sources: m.sources,
          })),
        );
        setSessionId(storedSessionId);
      } catch {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      } finally {
        setIsLoadingHistory(false);
      }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setIsSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed },
      { role: "assistant", content: "", pending: true },
    ]);

    try {
      const response = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId ?? undefined,
          message: trimmed,
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      for await (const event of readSseEvents(response)) {
        if (event.type === "token") {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1]!;
            next[next.length - 1] = {
              ...last,
              content: last.content + (event.value as string),
            };
            return next;
          });
        } else if (event.type === "done") {
          const newSessionId = event.sessionId as string;
          setSessionId(newSessionId);
          window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1]!;
            next[next.length - 1] = {
              ...last,
              id: event.messageId as string,
              sources: event.sources as (SourceRef | string)[],
              pending: false,
            };
            return next;
          });
        } else if (event.type === "error") {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: t("errorGeneric"),
              pending: false,
            };
            return next;
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: t("errorGeneric"),
          pending: false,
        };
        return next;
      });
    } finally {
      setIsSending(false);
    }
  }

  async function clearHistory() {
    if (sessionId) {
      await fetch(`/api/v1/chat?sessionId=${sessionId}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setMessages([]);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <ClearHistoryButton
          disabled={messages.length === 0}
          onClear={() => void clearHistory()}
        />
      </div>

      {isLoadingHistory ? (
        <p className="text-sm text-neutral-500">{t("loadingHistory")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {messages.length === 0 && (
            <StarterQuestions onSelect={(q) => void sendMessage(q)} />
          )}

          {messages.map((message, i) => (
            <div
              key={i}
              className={
                message.role === "user"
                  ? "ml-8 rounded-lg bg-emerald-700 px-4 py-2 text-white"
                  : "mr-8 flex flex-col gap-2 rounded-lg bg-neutral-100 px-4 py-2 dark:bg-neutral-900"
              }
            >
              <p className="whitespace-pre-wrap text-base">
                {message.content || (message.pending ? t("sending") : "")}
              </p>
              {message.role === "assistant" && !message.pending && (
                <>
                  {message.sources && message.sources.length > 0 && (
                    <SourceChips sources={message.sources} />
                  )}
                  <MessageFeedback messageId={message.id} />
                </>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label className="sr-only" htmlFor="assistant-input">
          {t("inputLabel")}
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={isSending}
          className="h-11 flex-1 rounded-md border border-neutral-300 px-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={isSending || !input.trim()}
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isSending ? t("sending") : t("send")}
        </button>
      </form>

      <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
        {t("disclaimer")}
      </p>
    </div>
  );
}
