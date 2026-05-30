"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Send, Mic, MicOff, Loader2, ChevronDown, CheckCircle, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

type PendingAction = { toolName: string; args: Record<string, unknown> };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  needsConfirmation?: boolean;
  pendingAction?: PendingAction;
  confirmed?: boolean;
  denied?: boolean;
};

type Props = {
  pageContext?: string;
};

export function PageAssistantPanel({ pageContext }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = pageContext
        ? `Привет! Я Джарвис. Контекст: ${pageContext}. Чем помочь?`
        : "Привет! Я Джарвис. Могу создать дело, найти клиента, показать статистику.";
      setMessages([{ id: "init", role: "assistant", content: greeting }]);
    }
  }, [open, messages.length, pageContext]);

  const sendMessage = useCallback(async (
    text: string,
    confirmed?: boolean,
    action?: PendingAction | null,
  ) => {
    if (!text.trim() && !confirmed) return;
    if (isLoading) return;

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
          messages: history.filter(m => m.id !== "init").map(m => ({ role: m.role, content: m.content })),
          confirmed,
          pendingAction: action ?? undefined,
        }),
      });

      const data = await res.json() as {
        reply?: string;
        error?: string;
        toolUsed?: string;
        needsConfirmation?: boolean;
        pendingAction?: PendingAction;
      };

      if (data.error) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Ошибка: ${data.error}`,
          isError: true,
        }]);
        return;
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply ?? "",
        needsConfirmation: data.needsConfirmation,
        pendingAction: data.pendingAction,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (data.needsConfirmation && data.pendingAction) {
        setPendingAction(data.pendingAction);
      } else {
        setPendingAction(null);
        // Refresh page if a mutating action completed
        if (data.toolUsed && ["create_case", "create_client", "update_case"].includes(data.toolUsed)) {
          router.refresh();
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Ошибка подключения. Попробуйте ещё раз.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, router]);

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || isLoading) return;
    const action = pendingAction;
    setPendingAction(null);
    setMessages(prev => prev.map(m =>
      m.pendingAction ? { ...m, confirmed: true, needsConfirmation: false } : m,
    ));
    await sendMessage("Да, разрешаю", true, action);
  }, [pendingAction, isLoading, sendMessage]);

  const handleDeny = useCallback(() => {
    if (!pendingAction) return;
    setPendingAction(null);
    setMessages(prev => [
      ...prev.map(m => m.pendingAction ? { ...m, denied: true, needsConfirmation: false } : m),
      { id: Date.now().toString(), role: "assistant", content: "Действие отменено. Чем ещё помочь?" },
    ]);
  }, [pendingAction]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { alert("Распознавание речи не поддерживается. Используйте Chrome."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const t = (e.results[0]?.[0]?.transcript ?? "") as string;
      if (t.trim()) sendMessage(t);
    };
    recognition.start();
  }, [isListening, sendMessage]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95"
          title="Джарвис — AI-ассистент"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-h-[540px] flex flex-col rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-2xl shadow-black/20 animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold">Джарвис</span>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            </div>
            <button onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className="flex flex-col gap-1.5 max-w-[85%]">
                  <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : msg.isError
                        ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-tl-sm"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>

                  {/* Confirmation buttons — only for the current active pending action */}
                  {msg.needsConfirmation && !msg.confirmed && !msg.denied &&
                   msg.pendingAction && pendingAction &&
                   msg.pendingAction.toolName === pendingAction.toolName && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Разрешаю
                      </button>
                      <button
                        onClick={handleDeny}
                        disabled={isLoading}
                        className="flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="h-3 w-3" />
                        Отмена
                      </button>
                    </div>
                  )}

                  {msg.confirmed && (
                    <span className="text-[10px] text-green-600 font-bold">✓ Выполнено</span>
                  )}
                  {msg.denied && (
                    <span className="text-[10px] text-red-500 font-bold">✗ Отменено</span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <div className="rounded-2xl rounded-tl-sm bg-zinc-100 dark:bg-zinc-800 px-3 py-2">
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex gap-2 shrink-0">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросить или дать команду..."
              className="resize-none min-h-[36px] max-h-[80px] text-xs dark:bg-zinc-900 dark:border-zinc-700"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex flex-col gap-1">
              <button
                onClick={toggleListening}
                className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  isListening
                    ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Collapse handle */}
          <button
            onClick={() => setOpen(false)}
            className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
