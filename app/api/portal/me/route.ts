import { NextResponse } from "next/server";
import { getPortalApiContext } from "@/lib/portal-api-context";
import { getPortalAiUsage } from "@/lib/portal-ai-usage";

export async function GET() {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;
  const usage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
  return NextResponse.json({
    client: ctx.client,
    usage,
  });
}
