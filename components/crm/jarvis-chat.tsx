"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Mic, MicOff, Loader2, CheckCircle, XCircle, Paperclip, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DownloadPdfButton } from "@/components/crm/download-pdf-button";
import { DownloadDocxButton } from "@/components/crm/download-docx-button";
import { useJarvisVoice, isVoiceConfirm, speakJarvis } from "@/components/crm/use-jarvis-voice";
import { isVoiceDeny } from "@/lib/jarvis/types";
import { JARVIS_PRESETS, getPreset, PRESET_FAST_COMMAND, type JarvisPresetId } from "@/lib/jarvis/presets";
import { VOICE_COMMAND_EXAMPLES, matchRegisterCaseVoice, parseAttachToCaseVoice } from "@/lib/jarvis/voice-commands";
import { extractCaseHintFromPageContext } from "@/lib/jarvis/case-resolve";
import type { JarvisAction, JarvisStep } from "@/lib/jarvis/types";
import { TOOL_LABELS } from "@/lib/jarvis/types";

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
  initialPreset?: JarvisPresetId;
  initialCaseQuery?: string;
  pageContext?: string;
  onSessionActivity?: () => void;
  onSessionTitle?: (title: string) => void;
};

const SUGGESTIONS = VOICE_COMMAND_EXAMPLES.slice(0, 6);

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
  if (toolName === "get_analytics" && typeof data === "object" && !Array.isArray(data) && "totals" in data) {
    const d = data as {
      totals: {
        cases: number;
        consultations: number;
        courtCases: number;
        documents: number;
        paymentsTotal: number;
        expectedTotal: number;
        paidOnCases: number;
      };
      byOutcome: Record<string, number>;
      byLawyer: Array<{ lawyer: string; cases: number }>;
    };
    return (
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Дела", d.totals.cases],
            ["Консультации", d.totals.consultations],
            ["Судебные", d.totals.courtCases],
            ["Документы", d.totals.documents],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
              <p className="text-lg font-semibold tabular-nums">{value as number}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-[13px] dark:border-zinc-800 dark:bg-zinc-900/30">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400">Финансы</p>
          <p>Ожидается: {d.totals.expectedTotal.toLocaleString("ru-RU")} ₸ · Оплачено по делам: {d.totals.paidOnCases.toLocaleString("ru-RU")} ₸ · Транзакции: {d.totals.paymentsTotal.toLocaleString("ru-RU")} ₸</p>
        </div>
        {Object.keys(d.byOutcome).length > 0 && (
          <div className="rounded-xl border border-zinc-200/80 px-3 py-2 dark:border-zinc-800">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-zinc-400">Исходы дел</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(d.byOutcome).map(([label, count]) => (
                <span key={label} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                  {label}: {count}
                </span>
              ))}
            </div>
          </div>
        )}
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
  if (toolName === "intake_new_case" && typeof data === "object" && data && "case" in data) {
    const d = data as {
      case: { code?: string; title?: string };
      document?: { type?: string; text?: string; legalSources?: Array<{ title: string; url: string }> } | null;
      legalSources?: Array<{ title: string; url: string }>;
    };
    return (
      <div className="mt-3 space-y-2">
        {d.case.code && (
          <p className="text-[13px] font-medium text-emerald-800 dark:text-emerald-200">
            Дело {d.case.code} — {d.case.title}
          </p>
        )}
        {d.document?.text && (
          <>
            <p className="text-[11px] uppercase tracking-wide text-zinc-400">Черновик {d.document.type ?? "документа"}</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <DownloadPdfButton
                title={`${d.case.code ?? "document"}-${d.document.type ?? "doc"}`}
                text={d.document.text}
              />
              <DownloadDocxButton
                title={`${d.case.code ?? "document"}-${d.document.type ?? "doc"}`}
                text={d.document.text}
              />
            </div>
            <pre className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/30">
              {d.document.text}
            </pre>
          </>
        )}
      </div>
    );
  }
  if (toolName === "generate_document" && typeof data === "object" && data && "text" in data) {
    const d = data as { type: string; text: string; legalSources?: Array<{ title: string; url: string }> };
    return (
      <div className="mt-3 space-y-2">
        {d.legalSources && d.legalSources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {d.legalSources.map(s => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-800 hover:underline dark:bg-emerald-900/30 dark:text-emerald-200"
              >
                {s.title.slice(0, 40)}…
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <DownloadPdfButton title={d.type} text={d.text} />
          <DownloadDocxButton title={d.type} text={d.text} />
        </div>
        <pre className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/30">
          {d.text}
        </pre>
      </div>
    );
  }
  if (toolName === "generate_for_case" && typeof data === "object" && data && "document" in data) {
    const d = data as {
      caseCode?: string;
      document?: { type?: string; text?: string } | null;
    };
    if (!d.document?.text) return null;
    const exportTitle = `${d.caseCode ?? "case"}-${d.document.type ?? "doc"}`;
    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <DownloadPdfButton title={exportTitle} text={d.document.text} />
          <DownloadDocxButton title={exportTitle} text={d.document.text} />
        </div>
        <pre className="max-h-64 overflow-y-auto rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 text-[13px] leading-relaxed whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/30">
          {d.document.text}
        </pre>
      </div>
    );
  }
  if (toolName === "search_adilet" && typeof data === "object" && data && "documents" in data) {
    const d = data as {
      documents: Array<{ title: string; url: string; type: string; snippet?: string; articleRef?: string }>;
    };
    if (!d.documents?.length) {
      return <p className="mt-3 text-[13px] text-zinc-500">В базе Әділет по запросу ничего не найдено.</p>;
    }
    return (
      <div className="mt-3 space-y-2">
        {d.documents.map(doc => (
          <a
            key={doc.url}
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-[13px] hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20"
          >
            <span className="font-medium text-emerald-900 dark:text-emerald-200">{doc.title}</span>
            <span className="ml-2 text-[10px] text-emerald-700">{doc.type}</span>
            {doc.articleRef && <p className="mt-1 text-[11px] text-emerald-800">{doc.articleRef}</p>}
            {doc.snippet && <p className="mt-1 line-clamp-2 text-[11px] text-zinc-600">{doc.snippet}</p>}
          </a>
        ))}
      </div>
    );
  }
  return null;
}

function ConfirmActionCard({
  action,
  onConfirm,
  onDeny,
  disabled,
}: {
  action: { toolName: string; args: Record<string, unknown> };
  onConfirm: () => void;
  onDeny: () => void;
  disabled?: boolean;
}) {
  const label = TOOL_LABELS[action.toolName] ?? action.toolName;
  const preview = Object.entries(action.args)
    .filter(([k, v]) => v != null && String(v).trim() && !["adiletQuery", "description"].includes(k))
    .map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`)
    .join(" · ");

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        Запрос на действие — требуется разрешение
      </p>
      <p className="mt-1 text-[14px] font-medium text-amber-950 dark:text-amber-100">{label}</p>
      {preview && <p className="mt-1 text-[12px] text-amber-900/80 dark:text-amber-200/80">{preview}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onConfirm} disabled={disabled} className="h-8 bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle className="mr-1 h-3.5 w-3.5" />
          Разрешаю
        </Button>
        <Button size="sm" variant="outline" onClick={onDeny} disabled={disabled} className="h-8">
          <XCircle className="mr-1 h-3.5 w-3.5" />
          Отмена
        </Button>
      </div>
    </div>
  );
}

export function JarvisChat({
  sessionId,
  initialPreset,
  initialCaseQuery,
  pageContext,
  onSessionActivity,
  onSessionTitle,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [presetId, setPresetId] = useState<JarvisPresetId>(initialPreset ?? "chat");
  const [files, setFiles] = useState<File[]>([]);
  const [presetOpen, setPresetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState("Думаю…");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [pendingAction, setPendingAction] = useState<Message["pendingAction"]>(undefined);
  const [attachCaseQuery, setAttachCaseQuery] = useState(initialCaseQuery ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef("");
  const endRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef(pendingAction);
  pendingRef.current = pendingAction;
  const sendRef = useRef<(text: string, confirmed?: boolean, action?: Message["pendingAction"]) => Promise<void>>(
    async () => {},
  );

  const preset = getPreset(presetId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    void (async () => {
      setLoadingHistory(true);
      setMessages([]);
      setPendingAction(undefined);
      setFiles([]);
      setPresetId(initialPreset ?? "chat");
      setAttachCaseQuery(initialCaseQuery ?? "");
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
          needsConfirmation: Boolean(m.metadata?.needsConfirmation),
          pendingAction: m.metadata?.pendingAction as Message["pendingAction"],
        }));
        setMessages(loaded);
        const lastOpen = [...loaded]
          .reverse()
          .find(m => m.needsConfirmation && m.pendingAction && !m.confirmed && !m.denied);
        if (lastOpen?.pendingAction) setPendingAction(lastOpen.pendingAction);
      } catch {
        setMessages([]);
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [sessionId, initialPreset, initialCaseQuery]);

  const applyActions = useCallback((actions?: JarvisAction[]) => {
    if (!actions?.length) return;
    for (const a of actions) {
      if (a.type === "navigate") router.push(a.path);
      if (a.type === "refresh") router.refresh();
    }
  }, [router]);

  const ingestCase = useCallback(async (comment: string, uploadFiles: File[]) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: comment || `Загрузка материалов: ${uploadFiles.map(f => f.name).join(", ")}`,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setFiles([]);
    setIsLoading(true);

    try {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("comment", comment);
      for (const f of uploadFiles) form.append("files", f);

      const res = await fetch("/api/ai/jarvis/ingest-case", { method: "POST", body: form });
      const data = await res.json() as {
        reply?: string;
        error?: string;
        actions?: JarvisAction[];
        case?: { code: string };
      };

      if (data.error) {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: data.error ?? "Ошибка импорта",
          isError: true,
        }]);
        return;
      }

      applyActions(data.actions);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "Дело зарегистрировано.",
      }]);

      if (data.case?.code) onSessionTitle?.(`Дело ${data.case.code}`);
      onSessionActivity?.();
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Не удалось загрузить материалы.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, applyActions, onSessionActivity, onSessionTitle]);

  const attachToCase = useCallback(async (caseQuery: string, comment: string, uploadFiles: File[]) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: comment || `Документы в ${caseQuery}: ${uploadFiles.map(f => f.name).join(", ")}`,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setFiles([]);
    setIsLoading(true);
    setLoadingHint("Загружаю файлы в дело…");

    try {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("caseQuery", caseQuery);
      form.append("comment", comment);
      for (const f of uploadFiles) form.append("files", f);

      const res = await fetch("/api/ai/jarvis/attach-to-case", { method: "POST", body: form });
      const data = await res.json() as {
        reply?: string;
        error?: string;
        actions?: JarvisAction[];
        case?: { code: string };
      };

      if (data.error) {
        setMessages(prev => [...prev, {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: data.error ?? "Ошибка загрузки",
          isError: true,
        }]);
        return;
      }

      applyActions(data.actions);
      speakJarvis(data.reply ?? "Файлы прикреплены");
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply ?? "Документы прикреплены к делу.",
      }]);
      onSessionActivity?.();
    } catch {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Не удалось прикрепить файлы.",
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
      setLoadingHint("Думаю…");
    }
  }, [sessionId, applyActions, onSessionActivity]);

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
    inputRef.current = "";
    setIsLoading(true);
    if (isConfirm && effective?.toolName === "intake_new_case") {
      setLoadingHint("Создаю дело, задачи и документ… до 1 минуты");
    } else if (isConfirm) {
      setLoadingHint("Выполняю…");
    } else {
      setLoadingHint("Думаю…");
    }

    try {
      const res = await fetch("/api/ai/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          confirmed: isConfirm,
          pendingAction: isConfirm ? effective ?? undefined : undefined,
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

      if (data.reply && !data.needsConfirmation) speakJarvis(data.reply);
      if (data.needsConfirmation && data.reply) {
        speakJarvis(`${data.reply} Скажите разрешаю или отмена.`);
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
      setLoadingHint("Думаю…");
    }
  }, [messages, isLoading, sessionId, pageContext, applyActions, onSessionActivity, onSessionTitle]);

  sendRef.current = sendMessage;

  const { isListening, interim, recordingDuration, toggleListening } = useJarvisVoice({
    onRecordingComplete: (text) => {
      if (pendingRef.current && isVoiceConfirm(text)) {
        void sendRef.current(text, true, pendingRef.current);
        return;
      }
      if (pendingRef.current && isVoiceDeny(text)) {
        handleDeny();
        return;
      }
      if (matchRegisterCaseVoice(text)) {
        setPresetId("register_case");
        setFiles([]);
        speakJarvis("Режим регистрации дела. Прикрепите PDF или текстовые файлы и нажмите отправить.");
        setMessages(prev => [...prev, {
          id: `h-${Date.now()}`,
          role: "assistant",
          content: "Режим «Зарегистрировать дело». Прикрепите материалы (.pdf, .txt) и нажмите отправить — создам карточку автоматически.",
        }]);
        return;
      }
      const defaultCase = attachCaseQuery || extractCaseHintFromPageContext(pageContext) || undefined;
      const attachQ = parseAttachToCaseVoice(text, defaultCase);
      if (attachQ) {
        setPresetId("attach_documents");
        setAttachCaseQuery(attachQ);
        setFiles([]);
        speakJarvis(`Режим прикрепления к делу ${attachQ}. Выберите файлы и нажмите отправить.`);
        setMessages(prev => [...prev, {
          id: `h-${Date.now()}`,
          role: "assistant",
          content: `Прикрепление к делу «${attachQ}». Выберите PDF или фото и нажмите отправить.`,
        }]);
        return;
      }
      const merged = inputRef.current.trim() ? `${inputRef.current.trim()} ${text}` : text;
      inputRef.current = merged;
      if (presetId === "register_case" || presetId === "attach_documents") {
        setInput(merged);
        return;
      }
      if (merged.trim().length >= 8) {
        setInput("");
        inputRef.current = "";
        void sendRef.current(merged.trim());
        return;
      }
      setInput(merged);
    },
  });

  const handleSubmit = () => {
    if (presetId === "register_case") {
      if (!files.length) return;
      void ingestCase(input.trim(), files);
      return;
    }

    if (presetId === "attach_documents") {
      const q = attachCaseQuery.trim() || extractCaseHintFromPageContext(pageContext) || "";
      if (!files.length || !q) return;
      void attachToCase(q, input.trim(), files);
      return;
    }

    const quick = PRESET_FAST_COMMAND[presetId];
    const text = input.trim() || quick || preset.starterPrompt || "";
    if (!text) return;

    if (quick && !input.trim()) {
      void sendMessage(quick);
      return;
    }

    if (preset.starterPrompt && !input.trim()) {
      void sendMessage(preset.starterPrompt);
      return;
    }

    void sendMessage(text);
  };

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

  const canSubmit = presetId === "register_case"
    ? files.length > 0 && !isLoading
    : presetId === "attach_documents"
      ? files.length > 0 && (attachCaseQuery.trim() || extractCaseHintFromPageContext(pageContext)) && !isLoading
      : (input.trim() || PRESET_FAST_COMMAND[presetId] || preset.starterPrompt) && !isLoading;

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
                Озвучьте задачу голосом или текстом — Джарвис создаст дела, задачи и документы. Нормы права — только из базы Әділет.
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

                {msg.needsConfirmation && !msg.confirmed && !msg.denied && (msg.pendingAction ?? pendingAction) && (
                  <ConfirmActionCard
                    action={(msg.pendingAction ?? pendingAction)!}
                    onConfirm={() => void handleConfirm()}
                    onDeny={handleDeny}
                    disabled={isLoading}
                  />
                )}
              </article>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {presetId === "register_case" ? "Анализирую материалы…" : loadingHint}
              </div>
            )}
          </div>
          <div ref={endRef} className="h-4" />
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-200/80 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setPresetOpen(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                {preset.label}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
              {presetOpen && (
                <>
                  <button type="button" className="fixed inset-0 z-10" aria-label="Закрыть" onClick={() => setPresetOpen(false)} />
                  <div className="absolute bottom-full left-0 z-20 mb-1 w-72 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    {JARVIS_PRESETS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPresetId(p.id);
                          setPresetOpen(false);
                          setFiles([]);
                        }}
                        className={`block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 ${p.id === presetId ? "bg-violet-50 dark:bg-violet-900/20" : ""}`}
                      >
                        <span className="block text-xs font-medium">{p.label}</span>
                        <span className="block text-[10px] text-zinc-500">{p.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {preset.acceptsFiles && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.pdf,text/plain,application/pdf"
                  className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files ?? []))}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:border-violet-400 hover:text-violet-700 dark:border-zinc-600"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Прикрепить файлы
                </button>
              </>
            )}
          </div>

          {files.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] dark:bg-zinc-800">
                  {f.name}
                  <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {presetId === "attach_documents" && (
            <div className="mb-2 flex items-center gap-2">
              <label className="text-[11px] text-zinc-500 shrink-0">Дело:</label>
              <input
                type="text"
                value={attachCaseQuery}
                onChange={e => setAttachCaseQuery(e.target.value)}
                placeholder="LC-2026-001 или фамилия клиента"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}

          {preset.fileHint && (
            <p className="mb-2 text-[11px] text-zinc-400">{preset.fileHint}</p>
          )}

          {isListening && (
            <p className="mb-2 text-center text-xs text-red-600 dark:text-red-400">
              ● Запись {recordingDuration} — говорите свободно, нажмите микрофон чтобы остановить
              {interim && <span className="mt-1 block text-zinc-500">«{interim.slice(-120)}»</span>}
            </p>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              value={input}
              onChange={e => {
                setInput(e.target.value);
                inputRef.current = e.target.value;
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={preset.placeholder}
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
              title={isListening ? "Остановить запись" : "Голосовой ввод — запись до остановки"}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            {presetId === "register_case"
              ? "Прикрепите материалы и отправьте — создам новое дело"
              : presetId === "attach_documents"
                ? "Укажите дело, прикрепите файлы и отправьте"
                : "Enter — отправить · Микрофон — говорите до стопа · «Разрешаю» — голосом или кнопкой"}
          </p>
        </div>
      </div>
    </div>
  );
}
