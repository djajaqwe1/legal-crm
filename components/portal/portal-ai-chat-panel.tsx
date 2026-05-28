"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { id: string; role: string; content: string; createdAt: string };

type Props = {
  endpoint: string;
  title: string;
  subtitle?: string;
};

export function PortalAiChatPanel({ endpoint, title, subtitle }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number; remaining: number } | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(endpoint, { credentials: "include" });
    const data = (await res.json()) as { messages?: Msg[]; usage?: typeof usage; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Не удалось загрузить чат.");
      return;
    }
    setMessages(data.messages ?? []);
    setUsage(data.usage ?? null);
    setError(null);
  }, [endpoint]);

  useEffect(() => {
    // Начальная загрузка истории; setState внутри fetch — после микротаска.
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text }),
      });
      const data = (await res.json()) as { reply?: string; error?: string; usage?: typeof usage };
      if (!res.ok) {
        setError(data.error ?? "Ошибка.");
        setInput(text);
        return;
      }
      if (data.usage) setUsage(data.usage);
      await load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[min(70vh,560px)] flex-col rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
        {usage ? (
          <p className="mt-1 text-xs text-zinc-500">
            ИИ сегодня (UTC): {usage.used} / {usage.limit} — осталось {usage.remaining}
          </p>
        ) : null}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !loading ? (
          <p className="text-sm text-zinc-500">Напишите вопрос — ответ появится ниже.</p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "mr-auto bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
            }`}
          >
            {m.role === "assistant" ? (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="whitespace-pre-wrap">{m.content}</p>
            )}
          </div>
        ))}
        {loading ? <p className="text-xs text-zinc-500">Отправка…</p> : null}
        <div ref={bottomRef} />
      </div>
      {error ? <p className="px-4 text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2 border-t border-zinc-100 p-3 dark:border-zinc-800">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ваш вопрос…"
          className="rounded-full"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button type="button" className="shrink-0 rounded-full px-4" disabled={loading} onClick={() => void send()}>
          Отправить
        </Button>
      </div>
    </div>
  );
}
