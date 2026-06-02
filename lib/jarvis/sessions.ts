import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated-client";

export type JarvisSessionListItem = {
  id: string;
  title: string;
  pinned: boolean;
  project: string | null;
  updatedAt: string;
  preview: string | null;
};

export async function listJarvisSessions(workspaceId: string): Promise<JarvisSessionListItem[]> {
  const sessions = await prisma.jarvisSession.findMany({
    where: { workspaceId },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: 50,
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true },
      },
    },
  });

  return sessions.map(s => ({
    id: s.id,
    title: s.title,
    pinned: s.pinned,
    project: s.project,
    updatedAt: s.updatedAt.toISOString(),
    preview: s.messages[0]?.content?.slice(0, 80) ?? null,
  }));
}

export async function createJarvisSession(workspaceId: string, title = "Новый чат") {
  return prisma.jarvisSession.create({
    data: { workspaceId, title },
  });
}

export async function getJarvisSession(workspaceId: string, sessionId: string) {
  return prisma.jarvisSession.findFirst({
    where: { id: sessionId, workspaceId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function updateJarvisSession(
  workspaceId: string,
  sessionId: string,
  data: { title?: string; pinned?: boolean; project?: string | null },
) {
  const existing = await prisma.jarvisSession.findFirst({
    where: { id: sessionId, workspaceId },
  });
  if (!existing) return null;
  return prisma.jarvisSession.update({
    where: { id: sessionId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.pinned !== undefined ? { pinned: data.pinned } : {}),
      ...(data.project !== undefined ? { project: data.project } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deleteJarvisSession(workspaceId: string, sessionId: string) {
  const existing = await prisma.jarvisSession.findFirst({
    where: { id: sessionId, workspaceId },
  });
  if (!existing) return false;
  await prisma.jarvisSession.delete({ where: { id: sessionId } });
  return true;
}

export async function appendJarvisMessages(
  sessionId: string,
  items: Array<{ role: string; content: string; metadata?: Record<string, unknown> }>,
) {
  if (!items.length) return;
  await prisma.jarvisMessage.createMany({
    data: items.map(m => ({
      sessionId,
      role: m.role,
      content: m.content,
      metadata: m.metadata ? (m.metadata as Prisma.InputJsonValue) : undefined,
    })),
  });
  await prisma.jarvisSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  });
}

export async function autoTitleSession(sessionId: string, firstUserMessage: string) {
  const title = firstUserMessage.trim().slice(0, 48) || "Новый чат";
  await prisma.jarvisSession.update({
    where: { id: sessionId },
    data: { title: title.length >= 48 ? `${title}…` : title },
  });
}
