import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/ai-service";

const SYSTEM_PROMPT = `Ты — помощник юриста. Твоя задача — извлечь структурированные данные из речи или текста и вернуть их в формате JSON.

Доступные статусы: "Новый", "В работе", "Суд", "Пауза", "Завершено"

Формат ответа — ТОЛЬКО валидный JSON без лишнего текста:
{
  "title": "название дела",
  "status": "один из доступных статусов",
  "deadline": "YYYY-MM-DD или null",
  "clientName": "имя клиента если упомянуто или null",
  "description": "описание сути дела",
  "suggestedCode": "LC-2026-XXX или null"
}

Если какое-то поле не упомянуто — ставь null. Дату всегда переводи в формат YYYY-MM-DD.`;

export async function POST(req: Request) {
  try {
    const { text, clients } = (await req.json()) as {
      text: string;
      clients?: { id: string; name: string }[];
    };

    if (!text?.trim()) {
      return NextResponse.json({ error: "Текст пуст" }, { status: 400 });
    }

    const clientList = clients?.length
      ? `\n\nСписок клиентов в системе:\n${clients.map((c) => `- ${c.name}`).join("\n")}`
      : "";

    const prompt = `Извлеки данные дела из следующего текста:

"${text}"${clientList}

Верни только JSON.`;

    const { text: raw } = await generateWithFallback(prompt, SYSTEM_PROMPT);

    // Extract JSON from response (Gemini sometimes wraps in ```json)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Не удалось распознать данные" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      title?: string;
      status?: string;
      deadline?: string;
      clientName?: string;
      description?: string;
      suggestedCode?: string;
    };

    // Match clientName to clientId
    let clientId: string | null = null;
    if (parsed.clientName && clients?.length) {
      const lower = parsed.clientName.toLowerCase();
      const match = clients.find(
        (c) =>
          c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
      );
      clientId = match?.id ?? null;
    }

    return NextResponse.json({ ...parsed, clientId });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
