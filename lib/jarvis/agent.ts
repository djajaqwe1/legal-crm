import { JARVIS_TOOLS } from "./tools";
import { executeJarvisTool, buildConfirmText } from "./executor";
import { createGeminiToolChat } from "@/lib/llm/router";
import { MUTATING_TOOLS, READ_ONLY_TOOLS, type JarvisAction, type JarvisStep } from "./types";

const MAX_AGENT_STEPS = 10;

type HistoryMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

export type AgentRunResult = {
  reply: string;
  steps: JarvisStep[];
  actions: JarvisAction[];
  toolUsed?: string;
  toolResult?: unknown;
  pendingAction?: { toolName: string; args: Record<string, unknown> };
  needsConfirmation?: boolean;
  modelUsed?: string;
  provider?: string;
};

export async function runJarvisAgent(
  workspaceId: string,
  systemInstruction: string,
  history: HistoryMessage[],
  lastMessage: string,
): Promise<AgentRunResult> {
  let chatResult;
  try {
    chatResult = await createGeminiToolChat(systemInstruction, JARVIS_TOOLS, history, lastMessage);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  const { response, chat, modelUsed, provider } = chatResult;
  const steps: JarvisStep[] = [];
  const actions: JarvisAction[] = [];
  let lastToolResult: unknown;
  let lastToolName: string | undefined;
  let currentResponse = response;

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const calls = currentResponse.functionCalls?.();
    if (!calls?.length) break;

    const mutating = calls.find(c => c.name && MUTATING_TOOLS.has(c.name));
    if (mutating?.name) {
      let confirmText = "";
      try {
        confirmText = currentResponse.text();
      } catch {
        confirmText = "";
      }
      if (!confirmText) {
        confirmText = buildConfirmText(mutating.name, (mutating.args ?? {}) as Record<string, unknown>);
      }

      return {
        reply: confirmText,
        steps,
        actions,
        toolUsed: mutating.name,
        pendingAction: { toolName: mutating.name, args: (mutating.args ?? {}) as Record<string, unknown> },
        needsConfirmation: true,
        modelUsed,
        provider,
      };
    }

    const functionResponses: Array<{ functionResponse: { name: string; response: { result: unknown } } }> = [];

    for (const call of calls) {
      const toolName = call.name ?? "";
      const args = (call.args ?? {}) as Record<string, unknown>;
      if (!toolName || !READ_ONLY_TOOLS.has(toolName)) continue;

      let result;
      try {
        result = await executeJarvisTool(workspaceId, toolName, args);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Tool failed";
        result = { success: false, message: msg, data: null };
      }
      steps.push({ tool: toolName, message: result.message, success: result.success });
      if (result.actions) actions.push(...result.actions);
      lastToolResult = result.data;
      lastToolName = toolName;

      functionResponses.push({
        functionResponse: {
          name: toolName,
          response: { result: result.data ?? result.message },
        },
      });
    }

    if (!functionResponses.length) break;

    try {
      currentResponse = (await chat.sendMessage(functionResponses)).response;
    } catch {
      break;
    }
  }

  let reply = "";
  try {
    reply = currentResponse.text();
  } catch {
    reply = steps.length
      ? steps.map(s => s.message).join(". ")
      : "Готово.";
  }

  if (!reply.trim() && steps.length) {
    reply = steps.map(s => s.message).join("\n");
  }

  return {
    reply,
    steps,
    actions,
    toolUsed: lastToolName,
    toolResult: lastToolResult,
    modelUsed,
    provider,
  };
}

export async function executeConfirmedAction(
  workspaceId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<AgentRunResult> {
  const result = await executeJarvisTool(workspaceId, toolName, args);
  return {
    reply: result.message,
    steps: [{ tool: toolName, message: result.message, success: result.success }],
    actions: result.actions ?? [],
    toolUsed: toolName,
    toolResult: result.data,
    needsConfirmation: false,
  };
}
