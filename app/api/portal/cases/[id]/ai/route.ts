import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalApiContext } from "@/lib/portal-api-context";
import { getCaseAssistantContext } from "@/lib/crm-repository";
import { askGeminiByCase } from "@/lib/gemini";
import { PORTAL_CASE_CONTEXT } from "@/lib/portal-constants";
import { getPortalAiUsage } from "@/lib/portal-ai-usage";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;
  const { id: caseId } = await params;

  const allowed = await prisma.legalCase.findFirst({
    where: {
      id: caseId,
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
    },
    select: { id: true },
  });
  if (!allowed) {
    return NextResponse.json({ error: "Дело не найдено." }, { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      legalCaseId: caseId,
      contextType: PORTAL_CASE_CONTEXT,
    },
    orderBy: { createdAt: "asc" },
    take: 80,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  const usage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
  return NextResponse.json({ messages, usage });
}

export async function POST(request: Request, { params }: Params) {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;
  const { id: caseId } = await params;

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
        error: `Достигнут дневной лимит ИИ-запросов (${usage.limit}).`,
        usage,
      },
      { status: 429 },
    );
  }

  const context = await getCaseAssistantContext(caseId, {
    workspaceId: ctx.workspaceId,
    clientId: ctx.clientId,
  });
  if (!context) {
    return NextResponse.json({ error: "Дело не найдено." }, { status: 404 });
  }

  await prisma.chatMessage.create({
    data: {
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
      legalCaseId: caseId,
      role: "user",
      content: message,
      contextType: PORTAL_CASE_CONTEXT,
    },
  });

  try {
    const reply = await askGeminiByCase(context, message);
    await prisma.chatMessage.create({
      data: {
        workspaceId: ctx.workspaceId,
        clientId: ctx.clientId,
        legalCaseId: caseId,
        role: "assistant",
        content: reply,
        contextType: PORTAL_CASE_CONTEXT,
      },
    });
    const nextUsage = await getPortalAiUsage(ctx.clientId, ctx.workspaceId);
    return NextResponse.json({ reply, usage: nextUsage });
  } catch (error: unknown) {
    console.error("Portal case AI:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка ИИ." },
      { status: 500 },
    );
  }
}
