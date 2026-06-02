import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { formatGeminiUserError } from "@/lib/gemini-models";
import { buildJarvisSystemPrompt, buildWorkspaceSnapshot } from "@/lib/jarvis/context";
import { runJarvisAgent, executeConfirmedAction } from "@/lib/jarvis/agent";
import { executeJarvisTool } from "@/lib/jarvis/executor";
import { matchJarvisIntent, formatToolReply } from "@/lib/jarvis/intents";
import { READ_ONLY_TOOLS } from "@/lib/jarvis/types";
import { VOICE_CONFIRM_RE } from "@/lib/jarvis/types";
import {
  appendJarvisMessages,
  autoTitleSession,
  createJarvisSession,
  getJarvisSession,
} from "@/lib/jarvis/sessions";

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
      sessionId?: string;
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

    const { sessionId: rawSessionId, messages, confirmed, pendingAction, pageContext } = body;

    let sessionId = rawSessionId;
    if (!sessionId) {
      const created = await createJarvisSession(wid, "Боковой ассистент");
      sessionId = created.id;
    }

    const session = await getJarvisSession(wid, sessionId);
    if (!session) {
      return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
    }

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

    const isFirstUserMessage = session.messages.filter(m => m.role === "user").length === 0;

    if (voiceConfirmed && pendingAction) {
      const result = await executeConfirmedAction(wid, pendingAction.toolName, pendingAction.args ?? {});
      const reply = result.steps[0]?.success ? result.reply : `Не удалось: ${result.reply}`;

      await appendJarvisMessages(sessionId, [
        { role: "user", content: lastText },
        {
          role: "assistant",
          content: reply,
          metadata: {
            toolUsed: result.toolUsed,
            toolResult: result.toolResult,
            steps: result.steps,
          },
        },
      ]);

      return NextResponse.json({
        reply,
        toolUsed: result.toolUsed,
        toolResult: result.toolResult,
        steps: result.steps,
        actions: result.actions,
        needsConfirmation: false,
      });
    }

    const snapshot = await buildWorkspaceSnapshot(wid);
    const systemPrompt = buildJarvisSystemPrompt(snapshot, pageContext);

    const intent = matchJarvisIntent(lastText);
    if (intent && READ_ONLY_TOOLS.has(intent.toolName)) {
      try {
        const toolResult = await executeJarvisTool(wid, intent.toolName, intent.args);
        const reply = formatToolReply(intent.toolName, toolResult.data, toolResult.message);

        await appendJarvisMessages(sessionId, [
          { role: "user", content: lastText },
          {
            role: "assistant",
            content: reply,
            metadata: {
              toolUsed: intent.toolName,
              toolResult: toolResult.data,
            },
          },
        ]);

        if (isFirstUserMessage && session.title === "Новый чат") {
          void autoTitleSession(sessionId, lastText);
        }

        return NextResponse.json({
          reply,
          toolUsed: intent.toolName,
          toolResult: toolResult.data,
          actions: toolResult.actions,
          needsConfirmation: false,
          sessionTitle: isFirstUserMessage ? lastText.slice(0, 48) : undefined,
          sessionId,
        });
      } catch (toolErr) {
        const msg = toolErr instanceof Error ? toolErr.message : "Tool error";
        const userMessage = formatGeminiUserError(msg);
        return NextResponse.json({ error: userMessage }, { status: 503 });
      }
    }

    const rawHistory = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: m.content || " " }],
    }));
    const firstUserIdx = rawHistory.findIndex(m => m.role === "user");
    const history = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

    const result = await runJarvisAgent(wid, systemPrompt, history, lastText);

    await appendJarvisMessages(sessionId, [
      { role: "user", content: lastText },
      {
        role: "assistant",
        content: result.reply,
        metadata: {
          toolUsed: result.toolUsed,
          toolResult: result.toolResult,
          steps: result.steps,
          needsConfirmation: result.needsConfirmation,
        },
      },
    ]);

    if (isFirstUserMessage && session.title === "Новый чат") {
      void autoTitleSession(sessionId, lastText);
    }

    return NextResponse.json({
      reply: result.reply,
      toolUsed: result.toolUsed,
      toolResult: result.toolResult,
      steps: result.steps,
      actions: result.actions,
      pendingAction: result.pendingAction,
      needsConfirmation: result.needsConfirmation,
      sessionTitle: isFirstUserMessage ? lastText.slice(0, 48) : undefined,
      sessionId,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    const userMessage = formatGeminiUserError(msg);
    const status = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") ? 429 : 503;
    return NextResponse.json({ error: userMessage }, { status });
  }
}
