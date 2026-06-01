"use server";

import { generateWithFallback } from "@/lib/ai-service";
import { formatGeminiUserError } from "@/lib/gemini-models";
import type { CaseAssistantContext } from "@/lib/crm-repository";

export async function askGeminiByCase(
  context: CaseAssistantContext,
  userMessage: string,
) {
  const prompt = buildPrompt(context, userMessage);

  try {
    const result = await generateWithFallback(prompt);
    return (
      result.text ??
      "Не удалось сгенерировать ответ. Попробуйте уточнить вопрос по делу."
    );
  } catch (error: unknown) {
    console.error("Gemini API Error in askGeminiByCase:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return formatGeminiUserError(msg);
  }
}

function buildPrompt(context: CaseAssistantContext, userMessage: string) {
  return `You are a legal AI assistant inside a CRM.
Work ONLY based on the case data provided in the context below.
If there is not enough data, write: "Insufficient data in the case file" and list what needs to be added.
Do not invent facts, details, court data, or legal norms.
Give the answer in Russian, briefly and structurally.

CASE CONTEXT:
- Code: ${context.code}
- Title: ${context.title}
- Client: ${context.client}
- Status: ${context.status}
- Deadline: ${context.deadline}
- Tasks: ${JSON.stringify(context.tasks)}
- Documents: ${JSON.stringify(context.documents)}

LAWYER'S QUESTION:
${userMessage}
`;
}
