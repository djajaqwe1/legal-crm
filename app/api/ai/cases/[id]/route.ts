import { NextResponse } from "next/server";
import { getCaseAssistantContext } from "@/lib/crm-repository";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { formatGeminiUserError } from "@/lib/gemini-models";
import { runCaseAgent } from "@/lib/case-agent/agent";
import { autoGenerateCaseTasks, matchCaseTaskIntent } from "@/lib/case-agent/intents";

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY не настроен" }, { status: 503 });
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
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const context = await getCaseAssistantContext(id, { workspaceId: wid });
    if (!context) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const userMessage = body.message.trim();

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        legalCaseId: id,
        role: "user",
        content: userMessage,
        contextType: "case",
      },
    });

    const prior = await prisma.chatMessage.findMany({
      where: { legalCaseId: id, contextType: "case", workspaceId: wid },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const history = prior
      .slice(0, -1)
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text: m.content }],
      }));

    let reply: string;
    let tasksCreated = 0;
    let toolUsed: string | undefined;

    if (matchCaseTaskIntent(userMessage)) {
      const auto = await autoGenerateCaseTasks(wid, context, userMessage);
      reply = auto.reply;
      tasksCreated = auto.tasksCreated;
      toolUsed = "add_tasks";
    } else {
      const result = await runCaseAgent(wid, context, history, userMessage);
      reply = result.reply;
      tasksCreated = result.tasksCreated;
      toolUsed = result.toolUsed;
    }

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        legalCaseId: id,
        role: "assistant",
        content: reply,
        contextType: "case",
      },
    });

    return NextResponse.json({ reply, tasksCreated, toolUsed, refresh: tasksCreated > 0 });
  } catch (error: unknown) {
    console.error("Case AI Error:", error);

    const msg = error instanceof Error ? error.message : String(error);
    const userMessage = formatGeminiUserError(msg);
    const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 503;

    return NextResponse.json({ error: userMessage }, { status });
  }
}
