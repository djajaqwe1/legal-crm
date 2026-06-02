import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { formatGeminiUserError } from "@/lib/gemini-models";
import { buildJarvisSystemPrompt, buildWorkspaceSnapshot } from "@/lib/jarvis/context";
import { runJarvisAgent, executeConfirmedAction } from "@/lib/jarvis/agent";
import { VOICE_CONFIRM_RE } from "@/lib/jarvis/types";

export const dynamic = "force-dynamic";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 40;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY не настроен на сервере" }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Слишком много запросов. Подождите минуту." }, { status: 429 });
  }

  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
    }

    let body: {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      confirmed?: boolean;
      pendingAction?: { toolName: string; args: Record<string, unknown> };
      pageContext?: string;
    };

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
    }

    const { messages, confirmed, pendingAction, pageContext } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Сообщения не переданы" }, { status: 400 });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      return NextResponse.json({ error: "Последнее сообщение должно быть от пользователя" }, { status: 400 });
    }

    const lastText = lastMsg.content?.trim() || " ";
    const voiceConfirmed =
      Boolean(pendingAction) &&
      (confirmed || VOICE_CONFIRM_RE.test(lastText));

    if (voiceConfirmed && pendingAction) {
      const result = await executeConfirmedAction(wid, pendingAction.toolName, pendingAction.args ?? {});
      if (!result.steps[0]?.success) {
        return NextResponse.json({
          reply: `Не удалось: ${result.reply}`,
          steps: result.steps,
          actions: result.actions,
          needsConfirmation: false,
        });
      }
      void saveChat(wid, lastText, result.reply);
      return NextResponse.json({
        reply: result.reply,
        toolUsed: result.toolUsed,
        toolResult: result.toolResult,
        steps: result.steps,
        actions: result.actions,
        needsConfirmation: false,
      });
    }

    const snapshot = await buildWorkspaceSnapshot(wid);
    const systemPrompt = buildJarvisSystemPrompt(snapshot, pageContext);

    const rawHistory = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content || " " }],
    }));
    const firstUserIdx = rawHistory.findIndex(m => m.role === "user");
    const history = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

    const result = await runJarvisAgent(wid, systemPrompt, history, lastText);

    void saveChat(wid, lastText, result.reply);

    return NextResponse.json({
      reply: result.reply,
      toolUsed: result.toolUsed,
      toolResult: result.toolResult,
      steps: result.steps,
      actions: result.actions,
      pendingAction: result.pendingAction,
      needsConfirmation: result.needsConfirmation,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    const userMessage = formatGeminiUserError(msg);
    const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 503;
    return NextResponse.json({ error: userMessage }, { status });
  }
}

async function saveChat(workspaceId: string, userContent: string, assistantContent: string) {
  try {
    await prisma.chatMessage.createMany({
      data: [
        { workspaceId, role: "user", content: userContent },
        { workspaceId, role: "assistant", content: assistantContent },
      ],
    });
  } catch {
    // ignore
  }
}
