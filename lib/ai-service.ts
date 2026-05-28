"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { LEGAL_TEAM_CONFIG } from "./agents/config";

const MODELS = [
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-pro-latest",
  "gemini-3-flash-preview"
];

// Обертка для совместимости со старым кодом
export async function askGeminiByCase(prompt: string, systemPrompt?: string) {
  const result = await generateWithFallback(prompt, systemPrompt);
  return result.text;
}

export async function analyzeContractCompliance(contractContent: string) {
  const complianceConfig = LEGAL_TEAM_CONFIG.COMPLIANCE;
  const prompt = `Проанализируй следующий текст договора на соответствие Гражданскому кодексу Республики Казахстан и выяви потенциальные риски ("подводные камни") для нашей стороны.
  
Текст договора:
${contractContent}

Дай ответ в формате:
1. Краткое резюме (насколько договор безопасен).
2. Список выявленных рисков.
3. Рекомендации по правкам в тексте.`;

  return await generateWithFallback(prompt, complianceConfig.systemPrompt);
}

export async function generateWithFallback(prompt: string, systemPrompt?: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing in process.env");
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Принудительно используем v1 (стабильную версию), так как v1beta у вас выдает 404
  const genAI = new GoogleGenerativeAI(apiKey);
  type AiError = { status?: number; message?: string };
  let lastError: unknown = null;

  for (const modelName of MODELS) {
    try {
      console.log(`>>> AI TRY (v1): ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();
      console.log(`Successfully generated content using ${modelName}`);
      return { text, model: modelName };
    } catch (error: unknown) {
      lastError = error;
      const e = error as AiError;
      console.error(`AI Error for ${modelName}:`, e.message, e.status);

      const isQuotaError =
        e?.status === 429 ||
        e?.message?.includes("429") ||
        e?.message?.toLowerCase().includes("quota");

      const isNotFoundError =
        e?.status === 404 ||
        e?.message?.includes("404") ||
        e?.message?.toLowerCase().includes("not found");

      const isServiceError =
        e?.status === 503 ||
        e?.status === 500 ||
        e?.message?.includes("503") ||
        e?.message?.includes("500") ||
        e?.message?.toLowerCase().includes("overloaded") ||
        e?.message?.toLowerCase().includes("unavailable");

      if (isQuotaError || isNotFoundError || isServiceError) {
        const reason = isQuotaError
          ? "quota limit"
          : isNotFoundError
            ? "not found (404)"
            : "service unavailable (503/500)";
        console.warn(`Model ${modelName} ${reason}. Trying next model...`);
        continue;
      }

      console.error(`Unexpected error with model ${modelName}:`, e.message);
      throw error;
    }
  }

  // If we've tried all models and all hit quota
  console.error("All available AI models hit quota limits.");
  throw lastError;
}
