import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { createJarvisSession, listJarvisSessions } from "@/lib/jarvis/sessions";
import {
  createOfflineJarvisSession,
  listOfflineJarvisSessions,
} from "@/lib/jarvis/offline-sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return NextResponse.json({ sessions: listOfflineJarvisSessions(), offline: true });
  }
  const sessions = await listJarvisSessions(wid);
  return NextResponse.json({ sessions, offline: false });
}

export async function POST(req: Request) {
  let title = "Новый чат";
  try {
    const body = await req.json() as { title?: string };
    if (body.title?.trim()) title = body.title.trim();
  } catch {
    // default title
  }

  const wid = await resolveWorkspaceId();
  if (!wid) {
    const session = createOfflineJarvisSession(title);
    return NextResponse.json(
      { session: { id: session.id, title: session.title }, offline: true },
      { status: 201 },
    );
  }

  const session = await createJarvisSession(wid, title);
  return NextResponse.json({ session: { id: session.id, title: session.title }, offline: false }, { status: 201 });
}
