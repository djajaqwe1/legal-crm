/**
 * In-memory сессии Jarvis, когда PostgreSQL недоступен (демо-режим).
 * Данные живут только пока работает процесс Node (dev / один инстанс serverless).
 */

export type OfflineJarvisMessage = {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type OfflineJarvisSession = {
  id: string;
  title: string;
  pinned: boolean;
  project: string | null;
  updatedAt: Date;
  messages: OfflineJarvisMessage[];
};

const sessions: Map<string, OfflineJarvisSession> =
  (globalThis as typeof globalThis & { __jarvisOfflineSessions?: Map<string, OfflineJarvisSession> })
    .__jarvisOfflineSessions ?? new Map();

if (process.env.NODE_ENV !== "production") {
  (globalThis as typeof globalThis & { __jarvisOfflineSessions?: Map<string, OfflineJarvisSession> }).__jarvisOfflineSessions =
    sessions;
}

function touch(session: OfflineJarvisSession) {
  session.updatedAt = new Date();
}

export function listOfflineJarvisSessions() {
  return [...sessions.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 50)
    .map(s => ({
      id: s.id,
      title: s.title,
      pinned: s.pinned,
      project: s.project,
      updatedAt: s.updatedAt.toISOString(),
      preview: s.messages.at(-1)?.content?.slice(0, 80) ?? null,
    }));
}

export function createOfflineJarvisSession(title = "Новый чат"): OfflineJarvisSession {
  const id = `offline-${crypto.randomUUID()}`;
  const session: OfflineJarvisSession = {
    id,
    title,
    pinned: false,
    project: null,
    updatedAt: new Date(),
    messages: [],
  };
  sessions.set(id, session);
  return session;
}

/** Восстановить offline-сессию после HMR / перезапуска dev-сервера. */
export function ensureOfflineJarvisSession(
  sessionId?: string,
  title = "Новый чат",
): OfflineJarvisSession {
  if (sessionId) {
    const existing = sessions.get(sessionId);
    if (existing) return existing;
    if (isOfflineJarvisSessionId(sessionId)) {
      const session: OfflineJarvisSession = {
        id: sessionId,
        title,
        pinned: false,
        project: null,
        updatedAt: new Date(),
        messages: [],
      };
      sessions.set(sessionId, session);
      return session;
    }
  }
  return createOfflineJarvisSession(title);
}

export function getOfflineJarvisSession(sessionId: string): OfflineJarvisSession | null {
  return sessions.get(sessionId) ?? null;
}

export function appendOfflineJarvisMessages(
  sessionId: string,
  items: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>,
) {
  const session = sessions.get(sessionId);
  if (!session || !items.length) return;
  for (const m of items) {
    session.messages.push({
      id: `m-${crypto.randomUUID()}`,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: new Date(),
    });
  }
  touch(session);
}

export function updateOfflineJarvisSession(
  sessionId: string,
  data: { title?: string; pinned?: boolean },
) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (data.title !== undefined) session.title = data.title;
  if (data.pinned !== undefined) session.pinned = data.pinned;
  touch(session);
  return session;
}

export function deleteOfflineJarvisSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function isOfflineJarvisSessionId(id: string): boolean {
  return id.startsWith("offline-");
}
