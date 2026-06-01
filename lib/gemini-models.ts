/**
 * Verified via GET /v1beta/models for the project's GEMINI_API_KEY.
 * Do not add gemini-1.5-* — they return 404 on current API keys.
 */
export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
] as const;

export type GeminiModelName = (typeof GEMINI_MODELS)[number];

export function isGeminiQuotaError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("resource_exhausted") ||
    m.includes("too many requests") ||
    m.includes("quotafailure") ||
    m.includes("quota")
  );
}

export function isGeminiModelNotFoundError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("404") || m.includes("not found");
}

export function isGeminiRetryableError(message: string): boolean {
  return isGeminiQuotaError(message) || isGeminiModelNotFoundError(message);
}

/** User-facing message — never expose raw Google API errors. */
export function formatGeminiUserError(message: string): string {
  if (isGeminiQuotaError(message)) {
    return "Превышен лимит запросов к AI. Подождите 1–2 минуты и попробуйте снова.";
  }
  if (isGeminiModelNotFoundError(message)) {
    return "AI-модель временно недоступна. Попробуйте через минуту или обновите GEMINI_API_KEY в Vercel.";
  }
  return "Не удалось получить ответ от AI. Попробуйте ещё раз.";
}
