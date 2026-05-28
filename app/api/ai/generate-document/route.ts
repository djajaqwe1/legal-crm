import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { isDatabaseReachable } from "@/lib/db-health";

export async function GET() {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ messages: [] });
    }
    const messages = await prisma.chatMessage.findMany({
      where: { contextType: "doc-builder", workspaceId: wid },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ messages });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function docBuilderSystemPrompt(type: string) {
  return `You are a professional lawyer from Kazakhstan. 
      Your task: create a legally correct document (${type}) based on the provided data.
      Use the laws of the Republic of Kazakhstan (Civil Code, Civil Procedure Code, etc.).
      The document must be structured, with an official tone.
      Return ONLY the text of the document in Markdown format.
      The output MUST be in Russian language.`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { prompt?: string; type?: string };
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const type = typeof body.type === "string" ? body.type : "Документ";
    if (!prompt) {
      return NextResponse.json({ error: "Укажите описание ситуации / данные для документа." }, { status: 400 });
    }

    const reachable = await isDatabaseReachable();
    const wid = reachable ? await resolveWorkspaceId() : null;

    const systemPrompt = docBuilderSystemPrompt(type);

    if (!reachable) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          {
            error:
              "База данных недоступна. Проверьте DATABASE_URL и доступность PostgreSQL.",
          },
          { status: 503 },
        );
      }
      const result = await generateWithFallback(`DATA: ${prompt}`, systemPrompt);
      return NextResponse.json({
        text: result.text,
        model: result.model,
        persistence: "skipped",
        warning:
          "Локальный режим без БД: текст сгенерирован, история и PDF-лог не сохраняются. Укажите рабочий DATABASE_URL для полного функционала.",
      });
    }

    if (!wid) {
      return NextResponse.json(
        {
          error:
            "Не удалось подключиться к данным workspace. Выполните prisma db push и prisma seed, либо проверьте логи сервера.",
        },
        { status: 503 },
      );
    }

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        role: "user",
        content: `Тип: ${type}. Запрос: ${prompt}`,
        contextType: "doc-builder",
      },
    });

    const result = await generateWithFallback(`DATA: ${prompt}`, systemPrompt);

    await prisma.chatMessage.create({
      data: {
        workspaceId: wid,
        role: "assistant",
        content: result.text,
        contextType: "doc-builder",
      },
    });

    return NextResponse.json({ text: result.text, model: result.model });
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);

    const isQuotaError =
      (error as { status?: number })?.status === 429 ||
      String(error).includes("429") ||
      String(error).includes("quota");

    if (isQuotaError) {
      return NextResponse.json(
        {
          error:
            "Все доступные ИИ-модели исчерпали дневной лимит. Пожалуйста, попробуйте позже или создайте новый API-ключ в Google AI Studio.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Ошибка при генерации документа",
        details: JSON.stringify(error),
      },
      { status: 500 },
    );
  }
}
