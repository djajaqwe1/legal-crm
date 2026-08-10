import { resolveWorkspaceId } from "@/lib/workspace-scope";
import {
  appendJarvisMessages,
  createJarvisSession,
  getJarvisSession,
} from "@/lib/jarvis/sessions";
import {
  appendOfflineJarvisMessages,
  ensureOfflineJarvisSession,
  isOfflineJarvisSessionId,
  updateOfflineJarvisSession,
} from "@/lib/jarvis/offline-sessions";

export type JarvisSessionHandle = {
  offline: boolean;
  workspaceId: string;
  sessionId: string;
  userMessageCount: number;
  title: string;
};

function countUserMessages(session: { messages: Array<{ role: string }> }): number {
  return session.messages.filter(m => m.role === "user").length;
}

export async function ensureJarvisSession(rawSessionId?: string | null): Promise<
  JarvisSessionHandle | { error: string; status: number }
> {
  const wid = await resolveWorkspaceId();

  if (!wid) {
    const session = ensureOfflineJarvisSession(rawSessionId ?? undefined);
    return {
      offline: true,
      workspaceId: "offline-workspace",
      sessionId: session.id,
      userMessageCount: countUserMessages(session),
      title: session.title,
    };
  }

  if (rawSessionId && isOfflineJarvisSessionId(rawSessionId)) {
    const created = await createJarvisSession(wid, "Новый чат");
    return {
      offline: false,
      workspaceId: wid,
      sessionId: created.id,
      userMessageCount: 0,
      title: created.title,
    };
  }

  let sessionId = rawSessionId ?? undefined;
  if (!sessionId) {
    const created = await createJarvisSession(wid, "Новый чат");
    sessionId = created.id;
  }
  let session = await getJarvisSession(wid, sessionId);
  if (!session) {
    const created = await createJarvisSession(wid, "Новый чат");
    sessionId = created.id;
    session = await getJarvisSession(wid, sessionId);
  }
  if (!session) return { error: "Не удалось создать чат", status: 503 };

  return {
    offline: false,
    workspaceId: wid,
    sessionId,
    userMessageCount: countUserMessages(session),
    title: session.title,
  };
}

export async function saveJarvisMessages(
  handle: JarvisSessionHandle,
  items: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>,
) {
  if (handle.offline) {
    appendOfflineJarvisMessages(handle.sessionId, items);
    return;
  }
  await appendJarvisMessages(handle.sessionId, items);
}

export async function autoTitleJarvisSession(
  handle: JarvisSessionHandle,
  firstUserMessage: string,
) {
  if (handle.offline) {
    updateOfflineJarvisSession(handle.sessionId, { title: firstUserMessage.slice(0, 48) });
    return;
  }
  const { autoTitleSession } = await import("@/lib/jarvis/sessions");
  await autoTitleSession(handle.sessionId, firstUserMessage);
}
