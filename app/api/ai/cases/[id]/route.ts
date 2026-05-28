import { NextResponse } from "next/server";
import { getCaseAssistantContext } from "@/lib/crm-repository";
import { askGeminiByCase } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ messages: [] });
    }
    const { id } = await params;
    const k = await prisma.legalCase.findFirst({
      where: { id, workspaceId: wid },
    });
    if (!k) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    const messages = await prisma.chatMessage.findMany({
      where: { legalCaseId: id, contextType: "case", workspaceId: wid },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { id } = await params;
    const body = (await request.json()) as { message?: string };

    if (!body.message?.trim()) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    const k = await prisma.legalCase.findFirst({
      where: { id, workspaceId: wid },
    });
    if (!k) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    const context = await getCaseAssistantContext(id);
    if (!context) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        legalCaseId: id,
        role: "user",
        content: body.message,
        contextType: "case",
      },
    });

    const reply = await askGeminiByCase(context, body.message);

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        legalCaseId: id,
        role: "assistant",
        content: reply,
        contextType: "case",
      },
    });

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    console.error("Case AI Error:", error);

    const isQuotaError =
      (error as { status?: number })?.status === 429 ||
      String(error).includes("429") ||
      String(error).includes("quota");

    if (isQuotaError) {
      return NextResponse.json(
        {
          error:
            "Превышена квота запросов AI. Пожалуйста, подождите 60 секунд и попробуйте снова. Если вы на бесплатном тарифе, лимиты очень строгие.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI service failed. Please try again.",
        details: JSON.stringify(error),
      },
      { status: 500 },
    );
  }
}
