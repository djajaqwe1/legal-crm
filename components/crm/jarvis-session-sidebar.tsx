"use client";

import { useState } from "react";
import {
  FolderOpen,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { JarvisSessionListItem } from "@/lib/jarvis/sessions";
import { fetchJson } from "@/lib/client-fetch";

type Props = {
  sessions: JarvisSessionListItem[];
  activeSessionId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRefresh: () => void;
  onClose?: () => void;
};

export function JarvisSessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRefresh,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = sessions.filter(s => {
    const q = query.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.project?.toLowerCase().includes(q) ?? false) ||
      (s.preview?.toLowerCase().includes(q) ?? false)
    );
  });

  const pinned = filtered.filter(s => s.pinned);
  const recent = filtered.filter(s => !s.pinned);
  const projects = [...new Set(sessions.map(s => s.project).filter(Boolean))] as string[];

  async function togglePin(id: string, pinned: boolean) {
    setActionError(null);
    const result = await fetchJson<{ session: { id: string } }>(`/api/ai/jarvis/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !pinned }),
    });
    if (!result.ok) {
      setActionError("Не удалось изменить закрепление");
      return;
    }
    onRefresh();
  }

  async function deleteSession(id: string) {
    if (!confirm("Удалить этот чат?")) return;
    setActionError(null);
    const result = await fetchJson<{ ok: boolean }>(`/api/ai/jarvis/sessions/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setActionError("Не удалось удалить чат");
      return;
    }
    onRefresh();
    if (id === activeSessionId) onNewChat();
  }

  function SessionRow({ s }: { s: JarvisSessionListItem }) {
    const active = s.id === activeSessionId;
    return (
      <div
        className={`group flex items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
          active
            ? "bg-zinc-100 dark:bg-zinc-800"
            : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            onSelect(s.id);
            onClose?.();
          }}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-[13px] font-medium leading-snug">{s.title}</p>
          {s.preview && (
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{s.preview}</p>
          )}
          {s.project && (
            <span className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
              {s.project}
            </span>
          )}
        </button>
        <div className="flex shrink-0 flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => void togglePin(s.id, s.pinned)}
            className="rounded p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            title={s.pinned ? "Открепить" : "Закрепить"}
          >
            {s.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => void deleteSession(s.id)}
            className="rounded p-1 text-zinc-400 hover:text-red-500"
            title="Удалить"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">История</span>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded p-1 text-zinc-400 xl:hidden">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-3">
        {actionError && (
          <p className="mb-2 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] text-red-600 dark:bg-red-950/30 dark:text-red-300">
            {actionError}
          </p>
        )}
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <Plus className="h-4 w-4" />
          Новый чат
        </button>
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск чатов…"
            className="w-full rounded-lg border border-zinc-200 bg-transparent py-2 pl-8 pr-3 text-xs outline-none focus:border-zinc-400 dark:border-zinc-700"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {projects.length > 0 && (
          <section className="mb-4">
            <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <FolderOpen className="h-3 w-3" />
              Проекты
            </p>
            <div className="space-y-0.5">
              {projects.slice(0, 6).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setQuery(p)}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        )}

        {pinned.length > 0 && (
          <section className="mb-4">
            <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              <Pin className="h-3 w-3" />
              Закреплённые
            </p>
            <div className="space-y-0.5">
              {pinned.map(s => (
                <SessionRow key={s.id} s={s} />
              ))}
            </div>
          </section>
        )}

        <section>
          <p className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <MessageSquare className="h-3 w-3" />
            Недавние
          </p>
          <div className="space-y-0.5">
            {recent.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-zinc-400">Нет чатов</p>
            ) : (
              recent.map(s => <SessionRow key={s.id} s={s} />)
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
