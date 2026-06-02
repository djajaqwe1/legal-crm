import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { getWorkspaceAnalytics } from "@/lib/analytics/workspace-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  const analytics = await getWorkspaceAnalytics(wid);
  return NextResponse.json(analytics);
}
