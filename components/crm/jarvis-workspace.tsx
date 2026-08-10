"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Menu, PanelRightClose, PanelRightOpen, Plus, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { CrmSidebar } from "@/components/crm/sidebar";
import { JarvisChat } from "@/components/crm/jarvis-chat";
import { JarvisSessionSidebar } from "@/components/crm/jarvis-session-sidebar";
import { ThemeToggle } from "@/components/crm/theme-toggle";
import type { JarvisSessionListItem } from "@/lib/jarvis/sessions";
import type { JarvisPresetId } from "@/lib/jarvis/presets";
import { fetchJson } from "@/lib/client-fetch";

const HISTORY_KEY = "jarvis-history-open";

function readHistoryOpen(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(HISTORY_KEY);
  return v !== "false";
}

export function JarvisWorkspace() {
  const searchParams = useSearchParams();
  const initialPreset = (searchParams.get("preset") as JarvisPresetId | null) ?? undefined;
  const initialCaseQuery = searchParams.get("case") ?? undefined;
  const autoRunPreset = searchParams.get("run") === "1";
  const [navOpen, setNavOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<JarvisSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  useEffect(() => {
    setHistoryOpen(readHistoryOpen());
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, String(historyOpen));
  }, [historyOpen]);

  const refreshSessions = useCallback(async () => {
    const result = await fetchJson<{ sessions: JarvisSessionListItem[]; offline?: boolean }>("/api/ai/jarvis/sessions");
    if (!result.ok) return null;
    setOfflineMode(result.data.offline === true);
    setSessions(result.data.sessions ?? []);
    return result.data.sessions ?? [];
  }, []);

  const createSession = useCallback(async () => {
    const result = await fetchJson<{ session: { id: string; title: string } }>("/api/ai/jarvis/sessions", {
      method: "POST",
    });
    if (!result.ok) return null;
    setSessionId(result.data.session.id);
    await refreshSessions();
    return result.data.session.id;
  }, [refreshSessions]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const list = await refreshSessions();
    if (list === null) {
      setLoadError("Не удалось загрузить чаты. Проверьте вход в систему или сеть.");
      setLoading(false);
      return;
    }
    if (list.length) {
      setSessionId(list[0].id);
      setLoading(false);
      return;
    }
    const id = await createSession();
    if (!id) {
      setLoadError("Не удалось создать чат. Попробуйте ещё раз или войдите заново.");
    }
    setLoading(false);
  }, [refreshSessions, createSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleNewChat = async () => {
    await createSession();
    setHistoryOpen(true);
  };

  const handleSelectSession = (id: string) => {
    setSessionId(id);
  };

  const handleSessionRenamed = (id: string, title: string) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, title } : s)));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Sparkles className="h-5 w-5 animate-pulse text-violet-500" />
          Загрузка Джарвис…
        </div>
      </div>
    );
  }

  if (loadError || !sessionId) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="flex max-w-md items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{loadError ?? "Чат недоступен"}</p>
            <p className="mt-1 text-xs opacity-80">
              Если вы не вошли — откройте{" "}
              <Link href="/login" className="underline">
                /login
              </Link>
              . Для полной CRM —{" "}
              <a href="https://project-072fj.vercel.app/admin" className="underline">
                prod
              </a>
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void bootstrap()}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          <RefreshCw className="h-4 w-4" />
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {navOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Закрыть меню CRM"
            onClick={() => setNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] shadow-xl lg:relative lg:z-0 lg:shadow-none">
            <CrmSidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {offlineMode && (
          <div className="border-b border-amber-200/80 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
            Демо без БД — чат работает, загрузка файлов и сохранение дел только на{" "}
            <a href="https://project-072fj.vercel.app/admin" className="underline">
              prod
            </a>
          </div>
        )}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200/80 bg-white/80 px-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <button
            type="button"
            onClick={() => setNavOpen(v => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Меню CRM"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <Link href="/admin/dashboard" className="truncate text-sm font-medium hover:text-violet-600">
              <Sparkles className="mr-1 inline h-4 w-4 shrink-0 text-violet-500" />
              Джарвис
            </Link>
          </div>

          <button
            type="button"
            onClick={() => void handleNewChat()}
            className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 sm:flex"
          >
            <Plus className="h-3.5 w-3.5" />
            Новый чат
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpen(v => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={historyOpen ? "Скрыть историю чатов" : "Показать историю чатов"}
          >
            {historyOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </header>

        <JarvisChat
          key={sessionId}
          sessionId={sessionId}
          initialPreset={initialPreset}
          initialCaseQuery={initialCaseQuery}
          autoRunPreset={autoRunPreset}
          onSessionActivity={() => void refreshSessions()}
          onSessionTitle={(title) => handleSessionRenamed(sessionId, title)}
          onSessionIdChange={setSessionId}
        />
      </div>

      {historyOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Закрыть историю"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-[min(100vw,300px)] border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950 md:relative md:z-0 md:w-[300px] md:shadow-none">
            <JarvisSessionSidebar
              sessions={sessions}
              activeSessionId={sessionId}
              onSelect={handleSelectSession}
              onNewChat={() => void handleNewChat()}
              onRefresh={() => void refreshSessions()}
              onClose={() => setHistoryOpen(false)}
            />
          </aside>
        </>
      )}
    </div>
  );
}
