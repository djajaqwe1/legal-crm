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
      "Не удалось сгенерировать ответ. Уточните вопрос по делу."
    );
  } catch (error: unknown) {
    console.error("Gemini API Error in askGeminiByCase:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return formatGeminiUserError(msg);
  }
}

function buildPrompt(context: CaseAssistantContext, userMessage: string) {
  const docs = context.documents
    .map(d => {
      const text = d.extractedText?.trim();
      return text ? `${d.name}: ${text.slice(0, 2000)}` : d.name;
    })
    .join("\n");

  return `Ты — юридический AI-ассистент в CRM Казахстана.
Отвечай по-русски, кратко и по делу. Опирайся на контекст ниже.

ДЕЛО: ${context.code} — ${context.title}
Клиент: ${context.client}
Статус: ${context.status}
Дедлайн: ${context.deadline}
${context.description ? `Описание: ${context.description}` : ""}

Задачи: ${JSON.stringify(context.tasks)}
Документы:
${docs || "нет"}

ВОПРОС:
${userMessage}
`;
}
