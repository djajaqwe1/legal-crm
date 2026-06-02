import { GoogleGenerativeAI, type ChatSession, type GenerativeModel } from "@google/generative-ai";
import { GEMINI_MODELS, isGeminiRetryableError } from "@/lib/gemini-models";
import type { CaseAssistantContext } from "@/lib/crm-repository";
import { CASE_AGENT_TOOLS, CASE_AGENT_TOOL_NAMES } from "./tools";
import { buildCaseSystemPrompt, executeCaseTool } from "./executor";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const MAX_STEPS = 6;

type HistoryMessage = { role: "user" | "model"; parts: Array<{ text: string }> };

export type CaseAgentResult = {
  reply: string;
  tasksCreated: number;
  toolUsed?: string;
};

export async function runCaseAgent(
  workspaceId: string,
  context: CaseAssistantContext,
  history: HistoryMessage[],
  userMessage: string,
): Promise<CaseAgentResult> {
  const systemInstruction = buildCaseSystemPrompt(context);
  const trimmedHistory = history.slice(-8);

  let chat: ChatSession | null = null;
  let response;
  let lastError: Error | null = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model: GenerativeModel = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [{ functionDeclarations: CASE_AGENT_TOOLS }],
      });
      chat = model.startChat({ history: trimmedHistory });
      response = (await chat.sendMessage(userMessage)).response;
      lastError = null;
      break;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      chat = null;
      if (!isGeminiRetryableError(lastError.message)) throw lastError;
    }
  }

  if (!response || !chat) throw lastError ?? new Error("Gemini unavailable");

  let tasksCreated = 0;
  let lastTool: string | undefined;
  const stepMessages: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const calls = response.functionCalls?.();
    if (!calls?.length) break;

    const functionResponses: Array<{ functionResponse: { name: string; response: { result: unknown } } }> = [];

    for (const call of calls) {
      const toolName = call.name ?? "";
      if (!toolName || !CASE_AGENT_TOOL_NAMES.has(toolName)) continue;

      const args = { ...(call.args ?? {} as Record<string, unknown>) };
      const result = await executeCaseTool(workspaceId, context.caseId, toolName, args);
      stepMessages.push(result.message);
      tasksCreated += result.tasksCreated ?? 0;
      lastTool = toolName;

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
    reply = response.text().trim();
  } catch {
    reply = "";
  }

  if (!reply && stepMessages.length) {
    reply = stepMessages.join("\n");
  }

  if (!reply) {
    reply = tasksCreated
      ? `Готово. В CRM добавлено задач: ${tasksCreated}.`
      : "Запрос обработан.";
  }

  return { reply, tasksCreated, toolUsed: lastTool };
}
