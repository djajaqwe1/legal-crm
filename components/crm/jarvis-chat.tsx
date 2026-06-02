"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic, MicOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useJarvisVoice, isVoiceConfirm } from "@/components/crm/use-jarvis-voice";
import type { JarvisAction, JarvisStep } from "@/lib/jarvis/types";

type ToolResult = Record<string, unknown> | unknown[] | null;

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  toolUsed?: string;
  toolResult?: ToolResult;
  steps?: JarvisStep[];
  pendingAction?: { toolName: string; args: Record<string, unknown> };
  needsConfirmation?: boolean;
  confirmed?: boolean;
  denied?: boolean;
};

type Props = {
  sessionId: string;
  onSessionActivity?: () => void;
  onSessionTitle?: (title: string) => void;
};

const SUGGESTIONS = [
  "Покажи статистику CRM",
  "Последние 5 дел",
  "Что просрочено?",
  "Открой реестр договоров",
];

function ResultCard({ toolName, data }: { toolName: string; data: ToolResult }) {
  if (!data) return null;
  if (toolName === "get_stats" && typeof data === "object" && !Array.isArray(data)) {
    const d = data as { cases: number; clients: number; contracts: number; overdue: number };
    return (
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Дела", d.cases],
          ["Клиенты", d.clients],
          ["Договоры", d.contracts],
          ["Просрочено", d.overdue],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value as number}</p>
          </div>
        ))}
      </div>
    );
  }
  if ((toolName === "get_cases" || toolName === "get_overdue_cases") && Array.isArray(data)) {
    return (
      <div className="mt-3 space-y-1">
        {(data as Array<{ id: string; code: string; title: string; client?: string }>).map(c => (
          <Link
            key={c.id}
            href={`/admin/cases/${c.id}`}
            className="block rounded-lg border border-zinc-200/80 px-3 py-2 text-[13px] hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span className="font-medium">{c.code}</span> — {c.title}
          </Link>
        ))}
      </div>
    );
  }
  if (toolName === "generate_document" && typeof data === "object" && data && "text" in data) {
    const d = data as { type: string; text: string };
    return (
      <pre className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/30">
        {d.text}
      </pre>
    );
  }
  return null;
}

export function JarvisChat({ sessionId, onSessionActivity, onSessionTitle }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [pendingAction, setPendingAction] = useState<Message["pendingAction"]>(undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pendingAction);
  pendingRef.current = pendingAction;
  const sendRef = useRef<(text: string, confirmed?: boolean, action?: Message["pendingAction"]) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    void (async () => {
      setLoadingHistory(true);
      setMessages([]);
      setPendingAction(undefined);
      try {
        const res = await fetch(`/api/ai/jarvis/sessions/${sessionId}`);
        if (!res.ok) throw new Error("load failed");
        const data = await res.json() as {
          session: { messages: Array<{ id: string; role: string; content: string; metadata?: Record<string, unknown> }> };
        };
        const loaded: Message[] = data.session.messages.map(m => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          toolUsed: m.metadata?.toolUsed as string | undefined,
          toolResult: m.metadata?.toolResult as ToolResult,
          steps: m.metadata?.steps as JarvisStep[] | undefined,
        }));
        setMessages(loaded);
      } catch {
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [sessionId]);

  const applyActions = useCallback((actions?: JarvisAction[]) => {
    if (!actions?.length) return;
    for (const a of actions) {
      if (a.type === "navigate") router.push(a.path);
      if (a.type === "refresh") router.refresh();
    }
  }, [router]);

  const sendMessage = useCallback(async (
    text: string,
    confirmed?: boolean,
    action?: Message["pendingAction"],
  ) => {
    if (!text.trim() && !confirmed) return;
    if (isLoading) return;

    const effective = action ?? pendingRef.current;
    const isConfirm = confirmed || (effective && isVoiceConfirm(text));

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: isConfirm ? (text || "Да, разрешаю") : text,
    };

    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          confirmed: isConfirm,
          pendingAction: isConfirm ? effective ?? undefined : undefined,
        }),
      });

      const data = await res.json() as {
        reply?: string;
        error?: string;
        toolUsed?: string;
        toolResult?: ToolResult;
        steps?: JarvisStep[];
        actions?: JarvisAction[];
        pendingAction?: Message["pendingAction"];
        needsConfirmation?: boolean;
        sessionTitle?: string;
      };

      if (data.error) {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: data.error ?? "Ошибка",
          isError: true,
        }]);
        return;
      }

      applyActions(data.actions);

      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "",
        toolUsed: data.toolUsed,
        toolResult: data.toolResult,
        steps: data.steps,
        pendingAction: data.pendingAction,
        needsConfirmation: data.needsConfirmation,
      }]);

      if (data.needsConfirmation && data.pendingAction) {
        setPendingAction(data.pendingAction);
      } else {
        setPendingAction(undefined);
      }

      if (data.sessionTitle) onSessionTitle?.(data.sessionTitle);
      onSessionActivity?.();
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Не удалось связаться с сервером.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, sessionId, applyActions, onSessionActivity, onSessionTitle]);

  sendRef.current = sendMessage;

  const { isListening, interim, toggleListening } = useJarvisVoice({
    onTranscript: (text) => {
      if (pendingRef.current && isVoiceConfirm(text)) {
        void sendRef.current(text, true, pendingRef.current);
      } else {
        void sendRef.current(text);
      }
    },
  });

  const handleConfirm = async () => {
    if (!pendingAction) return;
    const a = pendingAction;
    setPendingAction(undefined);
    setMessages(prev => prev.map(m => (m.pendingAction ? { ...m, confirmed: true, needsConfirmation: false } : m)));
    await sendMessage("Да, разрешаю", true, a);
  };

  const handleDeny = () => {
    setPendingAction(undefined);
    setMessages(prev => [
      ...prev.map(m => (m.pendingAction ? { ...m, denied: true, needsConfirmation: false } : m)),
      { id: `d-${Date.now()}`, role: "assistant", content: "Действие отменено." },
    ]);
  };

  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
                Чем могу помочь?
              </h2>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-zinc-500">
                Управляю делами, клиентами и договорами. История сохраняется автоматически.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void sendMessage(s)}
                    className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-[13px] text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-8">
            {messages.map(msg => (
              <article key={msg.id} className="group">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  {msg.role === "user" ? "Вы" : "Джарвис"}
                </p>
                <div
                  className={`text-[15px] leading-7 ${
                    msg.isError
                      ? "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
                      : msg.role === "user"
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>

                {msg.toolResult && msg.toolUsed && (
                  <ResultCard toolName={msg.toolUsed} data={msg.toolResult} />
                )}

                {msg.needsConfirmation && !msg.confirmed && !msg.denied && msg.pendingAction && pendingAction && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => void handleConfirm()} disabled={isLoading} className="h-8 bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle className="mr-1 h-3.5 w-3.5" />
                      Разрешаю
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDeny} disabled={isLoading} className="h-8">
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      Отмена
                    </Button>
                  </div>
                )}
              </article>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Думаю…
              </div>
            )}
          </div>
          <div ref={endRef} className="h-4" />
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200/80 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-3xl">
          {isListening && (
            <p className="mb-2 text-center text-xs text-zinc-500">
              {interim ? `«${interim}»` : "Слушаю…"}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Сообщение Джарвису…"
              rows={1}
              disabled={isLoading}
              className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] leading-relaxed outline-none placeholder:text-zinc-400"
            />
            <button
              type="button"
              onClick={toggleListening}
              disabled={isLoading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                isListening ? "bg-red-100 text-red-600" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
              title="Голосовой ввод"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Enter — отправить · Микрофон — голос (без озвучки ответов)
          </p>
        </div>
      </div>
    </div>
  );
}
