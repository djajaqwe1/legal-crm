"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type CaseAiChatProps = {
  caseId: string;
};

export function CaseAiChat({ caseId }: CaseAiChatProps) {
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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) return;

    const nextUserMessage: Message = { role: "user", content: input.trim() };
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
      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "AI helper error");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: payload.reply ?? "Пустой ответ модели." },
      ]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Ошибка AI-сервиса",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[360px] space-y-3 overflow-y-auto rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        {isHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Задай вопрос по делу: стратегия, список документов, риски, следующие шаги.
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
          placeholder="Например: Составь план следующего шага по делу"
          className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Думаю..." : "Спросить AI"}
        </Button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
