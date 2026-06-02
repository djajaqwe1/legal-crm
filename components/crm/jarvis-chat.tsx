"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic, MicOff, Bot, User, CheckCircle, XCircle, Loader2, Sparkles, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
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
  pendingAction?: { toolName: string; args: Record<string, unknown> };
  needsConfirmation?: boolean;
  confirmed?: boolean;
  denied?: boolean;
  steps?: JarvisStep[];
};

const TOOL_LABELS: Record<string, string> = {
  create_case: "Создать дело",
  create_client: "Создать клиента",
  create_contract: "Создать договор",
  update_case: "Обновить дело",
  add_task: "Добавить задачу",
  get_cases: "Поиск дел",
  get_clients: "Клиенты",
  get_contracts: "Договоры",
  get_overdue_cases: "Просроченные",
  find_case: "Поиск дела",
  navigate_to: "Навигация",
  get_stats: "Статистика",
  generate_document: "Документ",
};

const TOOL_COLORS: Record<string, string> = {
  create_case: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  create_client: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  create_contract: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  update_case: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  get_cases: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  get_clients: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  get_stats: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  generate_document: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

function ResultCard({ toolName, data }: { toolName: string; data: ToolResult }) {
  if (!data) return null;

  if (toolName === "get_stats") {
    const d = data as { cases: number; clients: number; contracts: number; overdue: number };
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[
          { label: "Дел", value: d.cases, color: "text-blue-600" },
          { label: "Клиентов", value: d.clients, color: "text-green-600" },
          { label: "Договоров", value: d.contracts, color: "text-purple-600" },
          { label: "Просрочено", value: d.overdue, color: "text-red-600" },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">{item.label}</p>
            <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (toolName === "get_cases" && Array.isArray(data)) {
    return (
      <div className="mt-2 space-y-1.5">
        {(data as Array<{ id: string; code: string; title: string; status: string; client: string }>).map(c => (
          <Link key={c.id} href={`/admin/cases/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            <span className="font-medium">{c.code} — {c.title}</span>
            <span className="text-zinc-400">{c.client}</span>
          </Link>
        ))}
      </div>
    );
  }

  if (toolName === "get_clients" && Array.isArray(data)) {
    return (
      <div className="mt-2 space-y-1.5">
        {(data as Array<{ id: string; name: string; phone: string }>).map(c => (
          <Link key={c.id} href={`/admin/clients/${c.id}`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
            <span className="font-medium">{c.name}</span>
            <span className="text-zinc-400">{c.phone}</span>
          </Link>
        ))}
      </div>
    );
  }

  if ((toolName === "create_case") && data && typeof data === "object") {
    const d = data as { id: string; code: string; title: string };
    return (
      <Link href={`/admin/cases/${d.id}`}
        className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs font-medium text-green-800 dark:text-green-300 hover:opacity-80 transition-opacity">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        Открыть: {d.code} — {d.title}
      </Link>
    );
  }

  if ((toolName === "create_client") && data && typeof data === "object") {
    const d = data as { id: string; name: string };
    return (
      <Link href={`/admin/clients/${d.id}`}
        className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs font-medium text-green-800 dark:text-green-300 hover:opacity-80 transition-opacity">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        Открыть клиента: {d.name}
      </Link>
    );
  }

  if (toolName === "create_contract" && data && typeof data === "object") {
    const d = data as { id: string; number: string };
    return (
      <Link href="/admin/contracts"
        className="mt-2 flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 px-3 py-2 text-xs font-medium text-violet-800 dark:text-violet-300 hover:opacity-80 transition-opacity">
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        Договор {d.number} создан — перейти к реестру
      </Link>
    );
  }

  if (toolName === "generate_document" && data && typeof data === "object") {
    const d = data as { type: string; text: string };
    return (
      <div className="mt-2 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/10 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-teal-100 dark:bg-teal-900/30">
          <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
            {d.type}
          </span>
          <button
            onClick={() => {
              const blob = new Blob([d.text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${d.type}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[10px] font-bold text-teal-700 dark:text-teal-300 hover:underline uppercase tracking-wider"
          >
            Скачать
          </button>
        </div>
        <pre className="p-3 text-[11px] text-teal-900 dark:text-teal-100 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-sans">
          {d.text}
        </pre>
      </div>
    );
  }

  return null;
}

export function JarvisChat({ pageContext }: { pageContext?: string } = {}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Джарвис на связи. Управляю CRM голосом или текстом: дела, клиенты, договоры, навигация, документы. Скажите «покажи статистику», «открой дела», «создай дело для Иванова» — или включите режим Jarvis для непрерывного голоса.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pendingAction);
  pendingRef.current = pendingAction;
  const voiceModeRef = useRef(voiceMode);
  voiceModeRef.current = voiceMode;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyActions = useCallback((actions?: JarvisAction[]) => {
    if (!actions?.length) return;
    for (const action of actions) {
      if (action.type === "navigate") router.push(action.path);
      if (action.type === "refresh") router.refresh();
    }
  }, [router]);

  const speakRef = useRef<(text: string) => void>(() => {});
  const sendMessageRef = useRef<(
    text: string,
    confirmed?: boolean,
    action?: { toolName: string; args: Record<string, unknown> } | null,
    fromVoice?: boolean,
  ) => Promise<void>>(async () => {});

  const { isListening, interim, speak, toggleListening, startListening } = useJarvisVoice({
    onTranscript: (text) => {
      if (pendingRef.current && isVoiceConfirm(text)) {
        void sendMessageRef.current(text, true, pendingRef.current, true);
      } else {
        void sendMessageRef.current(text, false, undefined, true);
      }
    },
  });
  speakRef.current = speak;

  const sendMessage = useCallback(async (
    text: string,
    confirmed?: boolean,
    action?: typeof pendingAction,
    fromVoice = false,
  ) => {
    if (!text.trim() && !confirmed) return;
    if (isLoading) return;

    const effectiveAction = action ?? pendingRef.current;
    const isConfirm = confirmed || (fromVoice && effectiveAction && isVoiceConfirm(text));

    const userMsg: Message = {
      id: Date.now().toString(),
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
          messages: history
            .filter(m => m.id !== "welcome")
            .map(m => ({ role: m.role, content: m.content })),
          confirmed: isConfirm,
          pendingAction: isConfirm ? effectiveAction ?? undefined : undefined,
          pageContext,
        }),
      });

      const data = await res.json() as {
        reply?: string;
        error?: string;
        toolUsed?: string;
        toolResult?: ToolResult;
        steps?: JarvisStep[];
        actions?: JarvisAction[];
        pendingAction?: { toolName: string; args: Record<string, unknown> };
        needsConfirmation?: boolean;
      };

      if (data.error) {
        const raw = data.error ?? "";
        const isQuota = res.status === 429 || raw.includes("лимит");
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant" as const,
          content: isQuota
            ? "⏳ Лимит Gemini. Подождите 1–2 минуты."
            : raw,
          isError: true,
        }]);
        return;
      }

      applyActions(data.actions);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply ?? "",
        toolUsed: data.toolUsed,
        toolResult: data.toolResult,
        steps: data.steps,
        pendingAction: data.pendingAction,
        needsConfirmation: data.needsConfirmation,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.needsConfirmation && data.pendingAction) {
        setPendingAction(data.pendingAction);
      } else {
        setPendingAction(null);
        if (data.toolUsed && ["create_case", "create_client", "update_case", "create_contract", "add_task"].includes(data.toolUsed)) {
          router.refresh();
        }
      }

      if (fromVoice || voiceModeRef.current) {
        speakRef.current(data.reply ?? "Готово");
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Ошибка подключения. Попробуйте ещё раз.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, pageContext, applyActions, router]);

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!voiceMode || isLoading || isListening || pendingAction) return;
    const t = setTimeout(() => startListening(), 1200);
    return () => clearTimeout(t);
  }, [voiceMode, isLoading, isListening, pendingAction, messages, startListening]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    setMessages(prev => prev.map(m =>
      m.pendingAction ? { ...m, confirmed: true, needsConfirmation: false } : m
    ));
    await sendMessage("Да, разрешаю", true, action);
  }, [pendingAction, sendMessage]);

  const handleDeny = useCallback(() => {
    setPendingAction(null);
    setMessages(prev => [
      ...prev.map(m => m.pendingAction ? { ...m, denied: true, needsConfirmation: false } : m),
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "Понял, отменяю действие. Что ещё нужно сделать?",
      },
    ]);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const quickCommands = [
    "Покажи статистику",
    "Последние 5 дел",
    "Что просрочено?",
    "Открой договоры",
    "Создай дело для тестового клиента",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <button
          type="button"
          onClick={() => setVoiceMode(v => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
            voiceMode
              ? "bg-violet-600 text-white border-violet-600"
              : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${voiceMode ? "animate-pulse" : ""}`} />
          {voiceMode ? "Режим Jarvis: вкл" : "Режим Jarvis: выкл"}
        </button>
        {voiceMode && (
          <span className="text-[11px] text-zinc-500">Говорите команды — отвечу голосом и выполню действие</span>
        )}
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {quickCommands.map(cmd => (
              <button
                key={cmd}
                onClick={() => sendMessage(cmd)}
                className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
              msg.role === "assistant"
                ? "bg-gradient-to-br from-blue-500 to-violet-600 text-white"
                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
            }`}>
              {msg.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </div>

            <div className={`max-w-[80%] space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              {msg.toolUsed && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${TOOL_COLORS[msg.toolUsed] ?? "bg-zinc-100 text-zinc-600"}`}>
                  <Bot className="h-2.5 w-2.5" />
                  {TOOL_LABELS[msg.toolUsed] ?? msg.toolUsed}
                </span>
              )}

              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : msg.isError
                    ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 rounded-tl-sm"
                    : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 rounded-tl-sm shadow-sm"
              }`}>
                {msg.isError && <span className="font-bold mr-1">⚠</span>}
                <span className="whitespace-pre-wrap">{msg.content}</span>
                {msg.isError && msg.content.includes("aistudio") && (
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 text-xs font-bold text-red-700 dark:text-red-400 underline"
                  >
                    → Открыть Google AI Studio
                  </a>
                )}
              </div>

              {msg.toolResult && <ResultCard toolName={msg.toolUsed!} data={msg.toolResult} />}

              {msg.steps && msg.steps.length > 1 && (
                <div className="mt-1 space-y-1 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-2 py-1.5">
                  {msg.steps.map((s, i) => (
                    <p key={i} className="text-[10px] text-zinc-500">
                      {s.success ? "✓" : "✗"} {TOOL_LABELS[s.tool] ?? s.tool}: {s.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Only show confirm buttons for the LATEST pending message, not all old ones */}
              {msg.needsConfirmation && !msg.confirmed && !msg.denied &&
               msg.pendingAction && pendingAction &&
               msg.pendingAction.toolName === pendingAction.toolName && (
                <div className="flex gap-2 mt-1">
                  <Button size="sm" onClick={handleConfirm} disabled={isLoading}
                    className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Разрешаю
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDeny} disabled={isLoading}
                    className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" />
                    Отмена
                  </Button>
                </div>
              )}

              {msg.confirmed && (
                <Badge className="text-[10px] bg-green-100 text-green-700 border-0">✓ Подтверждено</Badge>
              )}
              {msg.denied && (
                <Badge className="text-[10px] bg-red-100 text-red-700 border-0">✗ Отменено</Badge>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-zinc-200 dark:border-zinc-700 pt-4 space-y-2">
        {isListening && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {interim ? `Слышу: «${interim}»` : "Слушаю... говорите команду"}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Команда: «открой дела», «создай клиента»..."
            className="resize-none min-h-[44px] max-h-[120px] text-sm dark:bg-zinc-900 dark:border-zinc-700"
            rows={1}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1">
            <Button
              onClick={toggleListening}
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              className="h-[44px] w-[44px] shrink-0"
              title="Голосовой ввод"
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button
              onClick={() => sendMessage(input)}
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-[44px] w-[44px] shrink-0 bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
