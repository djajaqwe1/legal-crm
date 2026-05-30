"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Mic, MicOff, Bot, User, CheckCircle, XCircle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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
};

const TOOL_LABELS: Record<string, string> = {
  create_case: "Создать дело",
  create_client: "Создать клиента",
  update_case: "Обновить дело",
  get_cases: "Поиск дел",
  get_clients: "Поиск клиентов",
  get_stats: "Статистика",
};

const TOOL_COLORS: Record<string, string> = {
  create_case: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  create_client: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  update_case: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  get_cases: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  get_clients: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  get_stats: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
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

  return null;
}

export function JarvisChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Привет! Я Джарвис — ваш AI-помощник. Я могу создавать дела и клиентов, показывать статистику, искать информацию. Говорите голосом или пишите — я помогу.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ toolName: string; args: Record<string, unknown> } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string, confirmed?: boolean, action?: typeof pendingAction) => {
    if (!text.trim() && !confirmed) return;
    if (isLoading) return; // Prevent double-submit

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: confirmed ? (text || "Да, разрешаю") : text,
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
          // Filter out the initial welcome message (id="welcome") before sending to API
          messages: history
            .filter(m => m.id !== "welcome")
            .map(m => ({ role: m.role, content: m.content })),
          confirmed,
          pendingAction: action ?? undefined,
        }),
      });

      const data = await res.json() as {
        reply?: string;
        error?: string;
        toolUsed?: string;
        toolResult?: ToolResult;
        pendingAction?: { toolName: string; args: Record<string, unknown> };
        needsConfirmation?: boolean;
      };

      if (data.error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "assistant" as const,
          content: data.error ?? "Неизвестная ошибка",
          isError: true,
        }]);
        return;
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply ?? "",
        toolUsed: data.toolUsed,
        toolResult: data.toolResult,
        pendingAction: data.pendingAction,
        needsConfirmation: data.needsConfirmation,
      };

      setMessages(prev => [...prev, assistantMsg]);
      if (data.pendingAction) {
        setPendingAction(data.pendingAction);
      } else {
        setPendingAction(null);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: "Произошла ошибка подключения. Попробуйте ещё раз.",
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

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

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert("Ваш браузер не поддерживает распознавание речи. Используйте Chrome.");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = (event.results[0]?.[0]?.transcript ?? "") as string;
      if (transcript.trim()) {
        sendMessage(transcript);
      }
    };

    recognition.start();
  }, [isListening, sendMessage]);

  const quickCommands = [
    "Покажи статистику",
    "Последние 5 дел",
    "Список клиентов",
    "Дела в суде",
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
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
                {msg.content}
              </div>

              {msg.toolResult && <ResultCard toolName={msg.toolUsed!} data={msg.toolResult} />}

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
            Слушаю... говорите команду
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напишите команду или нажмите микрофон..."
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
