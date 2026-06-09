import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import {
  deleteJarvisSession,
  getJarvisSession,
  updateJarvisSession,
} from "@/lib/jarvis/sessions";
import {
  deleteOfflineJarvisSession,
  getOfflineJarvisSession,
  isOfflineJarvisSessionId,
  updateOfflineJarvisSession,
} from "@/lib/jarvis/offline-sessions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const wid = await resolveWorkspaceId();

  if (!wid || isOfflineJarvisSessionId(id)) {
    const session = getOfflineJarvisSession(id);
    if (!session) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    return NextResponse.json({
      session: {
        id: session.id,
        title: session.title,
        pinned: session.pinned,
        project: session.project,
        messages: session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
      },
      offline: true,
    });
  }

  const session = await getJarvisSession(wid, id);
  if (!session) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      pinned: session.pinned,
      project: session.project,
      messages: session.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    },
    offline: false,
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  let body: { title?: string; pinned?: boolean; project?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const wid = await resolveWorkspaceId();
  if (!wid || isOfflineJarvisSessionId(id)) {
    const updated = updateOfflineJarvisSession(id, body);
    if (!updated) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    return NextResponse.json({ session: { id: updated.id, title: updated.title, pinned: updated.pinned } });
  }

  const updated = await updateJarvisSession(wid, id, body);
  if (!updated) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  return NextResponse.json({
    session: {
      id: updated.id,
      title: updated.title,
      pinned: updated.pinned,
      project: updated.project,
    },
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const wid = await resolveWorkspaceId();

  if (!wid || isOfflineJarvisSessionId(id)) {
    const ok = deleteOfflineJarvisSession(id);
    if (!ok) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  const ok = await deleteJarvisSession(wid, id);
  if (!ok) return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
