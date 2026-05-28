import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/ai-service";

export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    const systemPrompt = `You are Strategist Agent, a highly qualified legal analyst from Kazakhstan.
      Your task: conduct a deep legal analysis of the situation or document text.
      
      Analysis criteria:
      1. Chances of success in court (in percentage) based on the Civil Procedure Code of Kazakhstan.
      2. Strengths of the position.
      3. Weaknesses and risks.
      4. Recommendations for strengthening the position (which documents to collect, which articles of the CC/CPC to refer to).
      5. Forecast of the opponent's tactics.

      Use current legislation of the Republic of Kazakhstan. 
      The answer must be structured, professional, and honest.
      Return ONLY the text of the analysis in Markdown format.
      The output MUST be in Russian language.`;

    const result = await generateWithFallback(
      `CONTENT TO ANALYZE: ${content}`,
      systemPrompt
    );

    return NextResponse.json({ text: result.text, model: result.model });
  } catch (error: unknown) {
    console.error("Strategist AI Error:", error);
    
    const e = error as { status?: number; message?: string };
    const isQuotaError =
      e?.status === 429 ||
      e?.message?.includes("429") ||
      e?.message?.includes("quota");

    if (isQuotaError) {
      return NextResponse.json(
        { error: "Все доступные ИИ-модели исчерпали дневной лимит. Пожалуйста, попробуйте позже или создайте новый API-ключ в Google AI Studio." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Ошибка при анализе стратегии",
        details: JSON.stringify(error)
      },
      { status: 500 }
    );
  }
}
