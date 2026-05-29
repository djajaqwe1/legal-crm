import { NextResponse } from "next/server";
import { generateWithFallback } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { ruToCaseStatus } from "@/lib/case-status";
import { CaseStatus } from "@/lib/generated-client";

const PARSE_PROMPT = `Ты — помощник юриста. Извлеки данные из голосовой команды и верни ТОЛЬКО валидный JSON без markdown:

{
  "clientName": "полное имя клиента или организации",
  "clientPhone": "телефон если упомянут или null",
  "caseTitle": "суть дела одной фразой",
  "status": "один из: Новый | В работе | Суд | Пауза | Завершено",
  "deadline": "YYYY-MM-DD или null",
  "description": "подробное описание если есть или null",
  "objectName": "название объекта/недвижимости если упомянуто или null"
}

Если поле не упомянуто — null. Статус по умолчанию "Новый".`;

export async function POST(req: Request) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
    }

    const { text } = (await req.json()) as { text: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "Текст пуст" }, { status: 400 });
    }

    // Step 1: Parse with Gemini
    const { text: raw } = await generateWithFallback(
      `Голосовая команда юриста: "${text}"\n\nВерни JSON.`,
      PARSE_PROMPT,
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Не удалось распознать данные" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      clientName?: string;
      clientPhone?: string;
      caseTitle?: string;
      status?: string;
      deadline?: string;
      description?: string;
      objectName?: string;
    };

    if (!parsed.clientName || !parsed.caseTitle) {
      return NextResponse.json(
        { error: "Не удалось определить клиента или название дела. Попробуйте сказать чётче." },
        { status: 422 },
      );
    }

    // Step 2: Find or create client
    const normalizedName = parsed.clientName.trim();
    let client = await prisma.client.findFirst({
      where: {
        workspaceId: wid,
        name: { contains: normalizedName, mode: "insensitive" },
      },
    });

    const isNewClient = !client;
    if (!client) {
      const phone = parsed.clientPhone?.trim() ?? null;
      const email = phone ? `voice-${phone.replace(/\D/g, "")}@crm.local` : `voice-${Date.now()}@crm.local`;
      client = await prisma.client.create({
        data: {
          workspaceId: wid,
          name: normalizedName,
          phone: phone ?? "",
          email,
          manager: "Рустем Айкимбаев",
        },
      });
    }

    // Step 3: Create object if mentioned
    let objectId: string | null = null;
    if (parsed.objectName) {
      const obj = await prisma.legalObject.create({
        data: {
          workspaceId: wid,
          clientId: client.id,
          name: parsed.objectName.trim(),
          type: "Иное",
        },
      });
      objectId = obj.id;
    }

    // Step 4: Generate case code
    const count = await prisma.legalCase.count({ where: { workspaceId: wid } });
    const code = `LC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

    // Step 5: Map status
    const statusRu = parsed.status ?? "Новый";
    const status: CaseStatus = ruToCaseStatus[statusRu] ?? CaseStatus.NEW;

    // Step 6: Create case
    const legalCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        clientId: client.id,
        objectId,
        code,
        title: parsed.caseTitle.trim(),
        status,
        description: parsed.description ?? null,
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
      },
    });

    return NextResponse.json({
      ok: true,
      isNewClient,
      client: { id: client.id, name: client.name },
      case: { id: legalCase.id, code: legalCase.code, title: legalCase.title },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
