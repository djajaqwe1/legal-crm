import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import {
  deleteJarvisSession,
  getJarvisSession,
  updateJarvisSession,
} from "@/lib/jarvis/sessions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  const { id } = await params;
  const session = await getJarvisSession(wid, id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  const { id } = await params;
  const body = await req.json() as { title?: string; pinned?: boolean; project?: string | null };
  const updated = await updateJarvisSession(wid, id, body);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  const { id } = await params;
  const ok = await deleteJarvisSession(wid, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
