import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { createJarvisSession, listJarvisSessions } from "@/lib/jarvis/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  const sessions = await listJarvisSessions(wid);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  let title = "Новый чат";
  try {
    const body = await req.json() as { title?: string };
    if (body.title?.trim()) title = body.title.trim();
  } catch {
    // default title
  }
  const session = await createJarvisSession(wid, title);
  return NextResponse.json({ session: { id: session.id, title: session.title } }, { status: 201 });
}
