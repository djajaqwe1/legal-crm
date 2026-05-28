"use server";

import { generateWithFallback } from "@/lib/ai-service";
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
    
    const e = error as { status?: number; message?: string };
    const isQuotaError =
      e?.status === 429 ||
      e?.message?.includes("429") ||
      e?.message?.includes("quota");

    if (isQuotaError) {
      return "Превышена квота запросов AI. Пожалуйста, подождите 60 секунд. Если вы на бесплатном тарифе, лимиты очень строгие. Рекомендуется использовать API-ключ от платного аккаунта Google Cloud.";
    }

    const isNotFoundError =
      e?.status === 404 ||
      e?.message?.includes("404") ||
      e?.message?.includes("not found");

    if (isNotFoundError) {
      console.error("Critical: All models returned 404.", error);
      return `Ошибка AI (404): Модели не найдены или доступ ограничен. Техническая ошибка: ${error instanceof Error ? error.message : JSON.stringify(error)}`;
    }
    
    return `Ошибка AI: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`;
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
