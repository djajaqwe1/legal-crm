import { GoogleGenerativeAI, type GenerativeModel, type ChatSession } from "@google/generative-ai";
import { GEMINI_MODELS, isGeminiRetryableError } from "@/lib/gemini-models";
import { JARVIS_TOOLS } from "./tools";
import { executeJarvisTool, buildConfirmText } from "./executor";
import { MUTATING_TOOLS, READ_ONLY_TOOLS, type JarvisAction, type JarvisStep } from "./types";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const MAX_AGENT_STEPS = 8;

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
};

export async function runJarvisAgent(
  workspaceId: string,
  systemInstruction: string,
  history: HistoryMessage[],
  lastMessage: string,
): Promise<AgentRunResult> {
  const trimmedHistory = history.slice(-10);
  let chat: ChatSession | null = null;
  let modelUsed: string = GEMINI_MODELS[0];
  let response;
  let lastSendError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [{ functionDeclarations: JARVIS_TOOLS }],
      });
      chat = model.startChat({ history: trimmedHistory });
      response = (await chat.sendMessage(lastMessage)).response;
      modelUsed = modelName;
      lastSendError = null;
      break;
    } catch (e) {
      lastSendError = e instanceof Error ? e : new Error(String(e));
      chat = null;
      if (!isGeminiRetryableError(lastSendError.message)) throw lastSendError;
      if (lastSendError.message.includes("429")) await new Promise(r => setTimeout(r, 1200));
    }
  }

  if (!response || !chat) throw lastSendError ?? new Error("All Gemini models failed");

  const steps: JarvisStep[] = [];
  const actions: JarvisAction[] = [];
  let lastToolResult: unknown;
  let lastToolName: string | undefined;

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const calls = response.functionCalls?.();
    if (!calls?.length) break;

    const mutating = calls.find(c => c.name && MUTATING_TOOLS.has(c.name));
    if (mutating?.name) {
      let confirmText = "";
      try {
        confirmText = response.text();
      } catch {
        confirmText = "";
      }
      if (!confirmText) confirmText = buildConfirmText(mutating.name, (mutating.args ?? {}) as Record<string, unknown>);

      return {
        reply: confirmText,
        steps,
        actions,
        toolUsed: mutating.name,
        pendingAction: { toolName: mutating.name, args: (mutating.args ?? {}) as Record<string, unknown> },
        needsConfirmation: true,
        modelUsed,
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
      response = (await chat.sendMessage(functionResponses)).response;
    } catch {
      break;
    }
  }

  let reply = "";
  try {
    reply = response.text();
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
