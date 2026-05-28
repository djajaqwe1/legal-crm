import { prisma } from "@/lib/prisma";
import { PORTAL_AI_CONTEXT, PORTAL_CASE_CONTEXT, getPortalAiDailyLimit } from "@/lib/portal-constants";

function utcDayStart(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function countPortalAiUserMessagesToday(
  clientId: string,
  workspaceId: string,
): Promise<number> {
  const from = utcDayStart();
  return prisma.chatMessage.count({
    where: {
      clientId,
      workspaceId,
      role: "user",
      contextType: { in: [PORTAL_AI_CONTEXT, PORTAL_CASE_CONTEXT] },
      createdAt: { gte: from },
    },
  });
}

export async function getPortalAiUsage(clientId: string, workspaceId: string) {
  const limit = getPortalAiDailyLimit();
  const used = await countPortalAiUserMessagesToday(clientId, workspaceId);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
