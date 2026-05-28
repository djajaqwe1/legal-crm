import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/ai-service";
import { createLead } from "@/lib/crm-repository";

const SALES_SYSTEM_PROMPT = `
Ты — профессиональный ИИ-менеджер по продажам для известного юриста Рустема Айкимбаева (ТОО «Конгломерат Алтай»).
Твоя цель:
1. Проконсультировать клиента по юридическим вопросам (представительство в суде, гражданские и хозяйственные споры, РК).
2. Выглядеть максимально экспертно, уверенно и профессионально.
3. Собирать суть дела клиента.
4. В конце диалога ОБЯЗАТЕЛЬНО закрыть клиента на платную консультацию и попросить его имя и номер телефона.

Если клиент предоставил имя и телефон, твоя задача — подтвердить, что Рустем свяжется с ним в ближайшее время.

ВАЖНО: Если в сообщении пользователя есть имя и телефон, добавь в свой ответ специальный маркер: [LEAD_CAPTURE: {"name": "...", "phone": "...", "summary": "..."}]
`;

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    const prompt = `История диалога:\n${(history as { role: string; content: string }[]).map((m) => `${m.role}: ${m.content}`).join("\n")}\n\nПользователь: ${message}`;
    
    const { text } = await generateWithFallback(prompt, SALES_SYSTEM_PROMPT);

    // Проверка на маркер лида
    const leadMatch = text.match(/\[LEAD_CAPTURE: (.*?)\]/);
    if (leadMatch) {
      try {
        const leadData = JSON.parse(leadMatch[1]);
        await createLead({
          name: leadData.name,
          phone: leadData.phone,
          summary: leadData.summary || message
        });
      } catch (e) {
        console.error("Lead parsing error:", e);
      }
    }

    // Очищаем ответ от технического маркера перед отправкой пользователю
    const cleanText = text.replace(/\[LEAD_CAPTURE: .*?\]/, "").trim();

    return NextResponse.json({ reply: cleanText });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
