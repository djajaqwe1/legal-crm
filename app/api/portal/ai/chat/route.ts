import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalApiContext } from "@/lib/portal-api-context";
import { PORTAL_AI_CONTEXT } from "@/lib/portal-constants";
import { getPortalAiUsage } from "@/lib/portal-ai-usage";
import { runPortalGeneralAi } from "@/lib/portal-ai-prompts";

export async function GET() {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;

  const messages = await prisma.chatMessage.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      legalCaseId: null,
      contextType: PORTAL_AI_CONTEXT,
    },
    orderBy: { createdAt: "asc" },
    take: 80,
    select: { id: true, role: true, content: true, createdAt: true },
  });

  const usage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
  return NextResponse.json({ messages, usage });
}

export async function POST(request: Request) {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;

  let body: { message?: string };
  try {
    body = (await request.json()) as { message?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Введите сообщение." }, { status: 400 });
  }

  const usage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
  if (usage.remaining <= 0) {
    return NextResponse.json(
      {
        error: `Достигнут дневной лимит ИИ-запросов (${usage.limit}). Лимит обновится завтра (UTC) или свяжитесь с юристом.`,
        usage,
      },
      { status: 429 },
    );
  }

  const recent = await prisma.chatMessage.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      legalCaseId: null,
      contextType: PORTAL_AI_CONTEXT,
    },
    orderBy: { createdAt: "desc" },
    take: 16,
    select: { role: true, content: true },
  });
  recent.reverse();
  const historyBlock = recent.map((m) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `${historyBlock ? `${historyBlock}\n\n` : ""}Пользователь:\n${message}`;

  await prisma.chatMessage.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      legalCaseId: null,
      role: "user",
      content: message,
      contextType: PORTAL_AI_CONTEXT,
    },
  });

  try {
    const { text, model } = await runPortalGeneralAi(prompt);
    await prisma.chatMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId: ctx.clientId,
        legalCaseId: null,
        role: "assistant",
        content: text,
        contextType: PORTAL_AI_CONTEXT,
      },
    });
    const nextUsage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
    return NextResponse.json({ reply: text, model, usage: nextUsage });
  } catch (error: unknown) {
    const isQuota =
      (error as { status?: number })?.status === 429 ||
      String(error).includes("429") ||
      String(error).toLowerCase().includes("quota");
    if (isQuota) {
      return NextResponse.json(
        { error: "Сервис ИИ временно перегружен. Попробуйте позже." },
        { status: 429 },
      );
    }
    console.error("Portal AI error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка ИИ." },
      { status: 500 },
    );
  }
}
