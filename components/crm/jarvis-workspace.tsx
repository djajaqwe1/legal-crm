"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu, PanelRight, Plus, Sparkles } from "lucide-react";
import { CrmSidebar } from "@/components/crm/sidebar";
import { JarvisChat } from "@/components/crm/jarvis-chat";
import { JarvisSessionSidebar } from "@/components/crm/jarvis-session-sidebar";
import { ThemeToggle } from "@/components/crm/theme-toggle";
import type { JarvisSessionListItem } from "@/lib/jarvis/sessions";

export function JarvisWorkspace() {
  const [navOpen, setNavOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<JarvisSessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSessions = useCallback(async () => {
    const res = await fetch("/api/ai/jarvis/sessions");
    if (!res.ok) return;
    const data = await res.json() as { sessions: JarvisSessionListItem[] };
    setSessions(data.sessions ?? []);
    return data.sessions ?? [];
  }, []);

  const createSession = useCallback(async () => {
    const res = await fetch("/api/ai/jarvis/sessions", { method: "POST" });
    if (!res.ok) return null;
    const data = await res.json() as { session: { id: string; title: string } };
    setSessionId(data.session.id);
    await refreshSessions();
    return data.session.id;
  }, [refreshSessions]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const list = await refreshSessions();
      if (list?.length) {
        setSessionId(list[0].id);
      } else {
        await createSession();
      }
      setLoading(false);
    })();
  }, [refreshSessions, createSession]);

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

  if (loading || !sessionId) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Sparkles className="h-5 w-5 animate-pulse text-violet-500" />
          Загрузка Джарвис…
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Left CRM drawer */}
      {navOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Закрыть меню"
            onClick={() => setNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[280px] shadow-xl lg:relative lg:shadow-none">
            <CrmSidebar onNavigate={() => setNavOpen(false)} />
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
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
            <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
            <span className="truncate text-sm font-medium">Джарвис</span>
          </div>

          <button
            type="button"
            onClick={handleNewChat}
            className="hidden items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 sm:flex"
          >
            <Plus className="h-3.5 w-3.5" />
            Новый чат
          </button>

          <button
            type="button"
            onClick={() => setHistoryOpen(v => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 xl:hidden"
            title="История чатов"
          >
            <PanelRight className="h-5 w-5" />
          </button>

          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </header>

        <JarvisChat
          key={sessionId}
          sessionId={sessionId}
          onSessionActivity={() => void refreshSessions()}
          onSessionTitle={(title) => handleSessionRenamed(sessionId, title)}
        />
      </div>

      {/* Right history sidebar */}
      {historyOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 xl:hidden"
            aria-label="Закрыть историю"
            onClick={() => setHistoryOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-[300px] border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 xl:relative xl:z-0">
            <JarvisSessionSidebar
              sessions={sessions}
              activeSessionId={sessionId}
              onSelect={handleSelectSession}
              onNewChat={handleNewChat}
              onRefresh={() => void refreshSessions()}
              onClose={() => setHistoryOpen(false)}
            />
          </aside>
        </>
      )}
    </div>
  );
}
