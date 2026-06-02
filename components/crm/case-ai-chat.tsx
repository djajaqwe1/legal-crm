"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { Loader2, CheckCircle2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type CaseAiChatProps = {
  caseId: string;
};

const QUICK_PROMPTS = [
  "Поставь задачи по делу в CRM",
  "Составь план следующих шагов и внеси задачи",
  "Какие риски по материалам?",
];

export function CaseAiChat({ caseId }: CaseAiChatProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/ai/cases/${caseId}`);
        const data = (await res.json()) as { messages?: { role: string; content: string }[] };
        if (data.messages) {
          setMessages(
            data.messages
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          );
        }
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setIsHistoryLoading(false);
      }
    }
    loadHistory();
  }, [caseId]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const nextUserMessage: Message = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, nextUserMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/ai/cases/${caseId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextUserMessage.content }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        tasksCreated?: number;
        refresh?: boolean;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "AI helper error");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: payload.reply ?? "Готово." },
      ]);

      if (payload.refresh || (payload.tasksCreated ?? 0) > 0) {
        router.refresh();
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Ошибка AI-сервиса",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(input);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => void sendMessage(p)}
            disabled={isLoading}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            AI сам вносит задачи и обновляет дело. Например: «Поставь задачи по делу в CRM».
          </p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-md p-3 text-sm ${
                message.role === "user"
                  ? "bg-zinc-900 text-zinc-100 dark:bg-zinc-200 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-200 dark:prose-pre:bg-zinc-900">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                message.content
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Например: Сам придумай задачи и внеси в систему"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Вношу…" : "Выполнить"}
        </Button>
      </form>

      <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Задачи и статус дела сохраняются в CRM автоматически
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
