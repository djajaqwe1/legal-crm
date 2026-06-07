import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { formatGeminiUserError } from "@/lib/gemini-models";
import { buildJarvisSystemPrompt, buildWorkspaceSnapshot } from "@/lib/jarvis/context";
import { runJarvisAgent, executeConfirmedAction } from "@/lib/jarvis/agent";
import { executeJarvisTool } from "@/lib/jarvis/executor";
import { matchJarvisIntent, formatToolReply } from "@/lib/jarvis/intents";
import {
  parseCaseIntakeRequest,
  buildIntakeConfirmReply,
} from "@/lib/jarvis/case-intake";
import { matchVoiceCommand } from "@/lib/jarvis/voice-commands";
import {
  extractCaseHintFromPageContext,
  formatCaseDisambiguation,
  resolveCaseQuery,
} from "@/lib/jarvis/case-resolve";
import { searchLegalGrounding } from "@/lib/legal-grounding/adilet-search";
import { JARVIS_CAPABILITIES_REPLY } from "@/lib/jarvis/help";
import { isVoiceConfirm, isVoiceDeny, READ_ONLY_TOOLS } from "@/lib/jarvis/types";
import {
  appendJarvisMessages,
  autoTitleSession,
  createJarvisSession,
  getJarvisSession,
} from "@/lib/jarvis/sessions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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

async function resolveVoiceCaseArgs(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ args: Record<string, unknown> } | { error: string }> {
  if (typeof args.caseId === "string" && args.caseId.trim()) {
    return { args };
  }
  const q = typeof args.caseQuery === "string" ? args.caseQuery : "";
  if (!q.trim()) return { args };

  const resolved = await resolveCaseQuery(workspaceId, q);
  if (resolved.type === "found") {
    const next: Record<string, unknown> = { ...args, caseId: resolved.case.id };
    delete next.caseQuery;
    return { args: next };
  }
  if (resolved.type === "ambiguous") {
    return { error: formatCaseDisambiguation(resolved.cases) };
  }
  return { error: `Дело «${q}» не найдено. Уточните код LC-2026-XXX или фамилию клиента.` };
}

async function runInstantVoiceTool(
  workspaceId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  if (toolName === "jarvis_help") {
    return {
      reply: JARVIS_CAPABILITIES_REPLY,
      toolUsed: "jarvis_help",
      toolResult: null,
      actions: [],
    };
  }

  if (toolName === "morning_brief") {
    const [daily, overdue] = await Promise.all([
      executeJarvisTool(workspaceId, "get_lawyer_daily", {}),
      executeJarvisTool(workspaceId, "get_overdue_cases", { limit: 5 }),
    ]);
    const dailyText = formatToolReply("get_lawyer_daily", daily.data, daily.message);
    const overdueText = formatToolReply("get_overdue_cases", overdue.data, overdue.message);
    return {
      reply: `${dailyText}\n\n---\n\n${overdueText}`,
      toolUsed: "get_lawyer_daily",
      toolResult: { daily: daily.data, overdue: overdue.data },
      actions: [...(daily.actions ?? []), ...(overdue.actions ?? [])],
    };
  }

  if (toolName === "overdue_alert") {
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const result = await executeJarvisTool(workspaceId, "get_overdue_cases", { limit });
    return {
      reply: formatToolReply("get_overdue_cases", result.data, result.message),
      toolUsed: "get_overdue_cases",
      toolResult: result.data,
      actions: result.actions ?? [],
    };
  }

  if (toolName === "case_brief") {
    const resolved = await resolveVoiceCaseArgs(workspaceId, args);
    if ("error" in resolved) {
      return { reply: resolved.error, toolUsed: "find_case", toolResult: null, actions: [] };
    }
    const caseId = resolved.args.caseId as string;
    const ctx = await executeJarvisTool(workspaceId, "get_case_context", { caseId });
    const reply = formatToolReply("get_case_context", ctx.data, ctx.message);
    return {
      reply,
      toolUsed: "get_case_context",
      toolResult: ctx.data,
      actions: [{ type: "navigate" as const, path: `/admin/cases/${caseId}` }],
    };
  }

  if (toolName === "open_case") {
    const resolved = await resolveCaseQuery(workspaceId, String(args.query ?? ""));
    if (resolved.type === "ambiguous") {
      return { reply: formatCaseDisambiguation(resolved.cases), toolUsed: "find_case", toolResult: resolved.cases, actions: [] };
    }
    if (resolved.type === "not_found") {
      return { reply: `Дело «${args.query}» не найдено.`, toolUsed: "find_case", toolResult: null, actions: [] };
    }
    const c = resolved.case;
    return {
      reply: `Открываю дело ${c.code} — ${c.title}`,
      toolUsed: "find_case",
      toolResult: c,
      actions: [{ type: "navigate" as const, path: `/admin/cases/${c.id}`, label: c.code }],
    };
  }

  if (toolName === "list_case_tasks" || toolName === "get_clients" || toolName === "search_adilet") {
    const prep = toolName === "list_case_tasks" ? await resolveVoiceCaseArgs(workspaceId, args) : { args };
    if ("error" in prep) {
      return { reply: prep.error, toolUsed: toolName, toolResult: null, actions: [] };
    }
    const result = await executeJarvisTool(workspaceId, toolName, prep.args);
    return {
      reply: formatToolReply(toolName, result.data, result.message),
      toolUsed: toolName,
      toolResult: result.data,
      actions: result.actions ?? [],
    };
  }

  const result = await executeJarvisTool(workspaceId, toolName, args);
  return {
    reply: formatToolReply(toolName, result.data, result.message),
    toolUsed: toolName,
    toolResult: result.data,
    actions: result.actions ?? [],
  };
}

export async function POST(req: Request) {
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
    const defaultCaseQuery = extractCaseHintFromPageContext(pageContext) ?? undefined;

    if (pendingAction && isVoiceDeny(lastText)) {
      const reply = "Действие отменено. Чем ещё помочь?";
      await appendJarvisMessages(sessionId, [
        { role: "user", content: lastText },
        { role: "assistant", content: reply, metadata: { denied: true } },
      ]);
      return NextResponse.json({ reply, needsConfirmation: false, sessionId });
    }

    const voiceConfirmed =
      Boolean(pendingAction) &&
      (confirmed || isVoiceConfirm(lastText));

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
        sessionId,
      });
    }

    const snapshot = await buildWorkspaceSnapshot(wid);
    const systemPrompt = buildJarvisSystemPrompt(snapshot, pageContext);

    const voiceCmd = matchVoiceCommand(lastText, { defaultCaseQuery });
    if (voiceCmd && !voiceConfirmed) {
      if (voiceCmd.instant) {
        const instant = await runInstantVoiceTool(wid, voiceCmd.toolName, voiceCmd.args);
        await appendJarvisMessages(sessionId, [
          { role: "user", content: lastText },
          {
            role: "assistant",
            content: instant.reply,
            metadata: { toolUsed: instant.toolUsed, toolResult: instant.toolResult },
          },
        ]);
        return NextResponse.json({
          reply: instant.reply,
          toolUsed: instant.toolUsed,
          toolResult: instant.toolResult,
          actions: instant.actions,
          needsConfirmation: false,
          sessionId,
        });
      }

      const resolved = await resolveVoiceCaseArgs(wid, voiceCmd.args);
      if ("error" in resolved) {
        await appendJarvisMessages(sessionId, [
          { role: "user", content: lastText },
          { role: "assistant", content: resolved.error },
        ]);
        return NextResponse.json({ reply: resolved.error, needsConfirmation: false, sessionId });
      }

      const nextPending = { toolName: voiceCmd.toolName, args: resolved.args };
      const reply = voiceCmd.confirmReply;

      await appendJarvisMessages(sessionId, [
        { role: "user", content: lastText },
        {
          role: "assistant",
          content: reply,
          metadata: { needsConfirmation: true, pendingAction: nextPending },
        },
      ]);

      return NextResponse.json({
        reply,
        pendingAction: nextPending,
        needsConfirmation: true,
        sessionId,
      });
    }

    const intake = parseCaseIntakeRequest(lastText);
    if (intake && !voiceConfirmed) {
      const grounding = await searchLegalGrounding(intake.adiletQuery, 4);
      const nextPending = {
        toolName: "intake_new_case",
        args: {
          clientName: intake.clientName,
          title: intake.title,
          description: intake.description,
          deadline: intake.deadline,
          documentType: intake.documentType,
          workflowId: intake.workflowId,
          adiletQuery: intake.adiletQuery,
        },
      };
      const reply = buildIntakeConfirmReply(intake, grounding.contextBlock, grounding.documents.length);

      await appendJarvisMessages(sessionId, [
        { role: "user", content: lastText },
        {
          role: "assistant",
          content: reply,
          metadata: {
            toolUsed: "search_adilet",
            toolResult: grounding,
            needsConfirmation: true,
            pendingAction: nextPending,
          },
        },
      ]);

      if (isFirstUserMessage && session.title === "Новый чат") {
        void autoTitleSession(sessionId, intake.title);
      }

      return NextResponse.json({
        reply,
        toolUsed: "search_adilet",
        toolResult: grounding,
        pendingAction: nextPending,
        needsConfirmation: true,
        sessionTitle: isFirstUserMessage ? intake.title.slice(0, 48) : undefined,
        sessionId,
      });
    }

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY не настроен. Для этой команды нужен AI — попробуйте голосовые команды из списка." },
        { status: 503 },
      );
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
          pendingAction: result.pendingAction,
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
