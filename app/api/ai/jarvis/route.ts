import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { ruToCaseStatus, caseStatusToRu } from "@/lib/case-status";
import { CaseStatus } from "@/lib/generated-client";

export const dynamic = "force-dynamic";

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];

const SYSTEM_PROMPT = `Ты — Джарвис, умный AI-помощник для юридической фирмы ТОО «Конгломерат Алтай».
Ты помогаешь юристу управлять делами, клиентами и договорами.
Ты понимаешь голосовые команды на русском языке.
Когда юрист просит создать, изменить или найти что-то — используй соответствующий инструмент.
Перед выполнением действия (create/update/delete) ВСЕГДА сначала объясни что ты собираешься сделать,
и спроси подтверждение. Отвечай на русском языке, кратко и по делу.`;

// Tool declarations for Gemini
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools = [
  {
    name: "create_case",
    description: "Создать новое дело. Вызывай только после получения подтверждения от юриста.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING, description: "Название/суть дела" },
        clientName: { type: SchemaType.STRING, description: "Имя клиента" },
        status: { type: SchemaType.STRING, enum: ["Новый", "В работе", "Суд", "Пауза", "Завершено"], description: "Статус дела" },
        deadline: { type: SchemaType.STRING, description: "Дедлайн в формате YYYY-MM-DD или пустая строка" },
        description: { type: SchemaType.STRING, description: "Описание дела" },
      },
      required: ["title", "clientName"],
    },
  },
  {
    name: "create_client",
    description: "Создать нового клиента.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING, description: "ФИО или название организации" },
        phone: { type: SchemaType.STRING, description: "Номер телефона" },
        email: { type: SchemaType.STRING, description: "Email адрес" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_case",
    description: "Обновить поле существующего дела. Вызывай только после подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        caseId: { type: SchemaType.STRING, description: "ID дела (получи через get_cases)" },
        field: { type: SchemaType.STRING, enum: ["status", "description", "deadline", "title"], description: "Поле для обновления" },
        value: { type: SchemaType.STRING, description: "Новое значение" },
      },
      required: ["caseId", "field", "value"],
    },
  },
  {
    name: "get_cases",
    description: "Получить список дел с фильтрацией. Не требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        status: { type: SchemaType.STRING, description: "Фильтр по статусу на русском: Новый | В работе | Суд | Пауза | Завершено" },
        clientName: { type: SchemaType.STRING, description: "Фильтр по имени клиента" },
        limit: { type: SchemaType.NUMBER, description: "Максимум записей, по умолчанию 5" },
      },
    },
  },
  {
    name: "get_clients",
    description: "Получить список клиентов. Не требует подтверждения.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        search: { type: SchemaType.STRING, description: "Поиск по имени" },
        limit: { type: SchemaType.NUMBER, description: "Максимум записей, по умолчанию 5" },
      },
    },
  },
  {
    name: "get_stats",
    description: "Получить общую статистику по системе: количество дел, клиентов, договоров, просроченных дел.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any as FunctionDeclaration[];

async function executeToolCall(
  wid: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ success: boolean; data?: unknown; message: string }> {
  if (toolName === "get_stats") {
    const [cases, clients, contracts, overdue] = await Promise.all([
      prisma.legalCase.count({ where: { workspaceId: wid } }),
      prisma.client.count({ where: { workspaceId: wid } }),
      // Count ALL contracts in workspace (not just those linked to cases)
      prisma.contract.count({ where: { workspaceId: wid } }),
      prisma.legalCase.count({
        where: {
          workspaceId: wid,
          deadline: { lt: new Date() },
          status: { not: CaseStatus.CLOSED },
        },
      }),
    ]);
    return {
      success: true,
      data: { cases, clients, contracts, overdue },
      message: `Дел: ${cases}, Клиентов: ${clients}, Договоров: ${contracts}, Просрочено: ${overdue}`,
    };
  }

  if (toolName === "get_cases") {
    const { status, clientName, limit = 5 } = args as { status?: string; clientName?: string; limit?: number };
    // Properly map Russian status to enum
    const statusEnum = status ? (ruToCaseStatus[status] ?? undefined) : undefined;
    const cases = await prisma.legalCase.findMany({
      where: {
        workspaceId: wid,
        ...(statusEnum ? { status: statusEnum } : {}),
        ...(clientName ? { client: { name: { contains: clientName, mode: "insensitive" } } } : {}),
      },
      include: { client: true },
      orderBy: { createdAt: "desc" },
      take: typeof limit === "number" ? limit : 5,
    });
    return {
      success: true,
      data: cases.map(c => ({
        id: c.id,
        code: c.code,
        title: c.title,
        // Return Russian status labels, not raw enum
        status: caseStatusToRu[c.status as CaseStatus] ?? c.status,
        client: c.client?.name ?? "—",
        deadline: c.deadline ? new Date(c.deadline).toLocaleDateString("ru-RU") : "Без срока",
      })),
      message: `Найдено ${cases.length} дел`,
    };
  }

  if (toolName === "get_clients") {
    const { search, limit = 5 } = args as { search?: string; limit?: number };
    const clients = await prisma.client.findMany({
      where: {
        workspaceId: wid,
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: typeof limit === "number" ? limit : 5,
    });
    return {
      success: true,
      data: clients.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
      message: `Найдено ${clients.length} клиентов`,
    };
  }

  if (toolName === "create_client") {
    const { name, phone = "", email } = args as { name: string; phone?: string; email?: string };
    // Check if client already exists
    const existing = await prisma.client.findFirst({
      where: { workspaceId: wid, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return { success: true, data: existing, message: `Клиент "${name}" уже существует` };
    }
    const generatedEmail = email ?? `client-${Date.now()}@crm.local`;
    const client = await prisma.client.create({
      data: { workspaceId: wid, name, phone, email: generatedEmail, manager: "Рустем Айкимбаев" },
    });
    return { success: true, data: { id: client.id, name: client.name }, message: `Клиент "${name}" создан` };
  }

  if (toolName === "create_case") {
    const { title, clientName, status = "Новый", deadline, description } = args as {
      title: string; clientName: string; status?: string; deadline?: string; description?: string;
    };
    // Use exact name match first, then fuzzy
    let client = await prisma.client.findFirst({
      where: { workspaceId: wid, name: { equals: clientName, mode: "insensitive" } },
    });
    if (!client) {
      client = await prisma.client.findFirst({
        where: { workspaceId: wid, name: { contains: clientName, mode: "insensitive" } },
      });
    }
    if (!client) {
      client = await prisma.client.create({
        data: { workspaceId: wid, name: clientName, phone: "", email: `voice-${Date.now()}@crm.local`, manager: "Рустем Айкимбаев" },
      });
    }
    const count = await prisma.legalCase.count({ where: { workspaceId: wid } });
    const year = new Date().getFullYear();
    const code = `LC-${year}-${String(count + 1).padStart(3, "0")}`;
    const caseStatus: CaseStatus = ruToCaseStatus[status] ?? CaseStatus.NEW;
    // Validate deadline
    let deadlineDate: Date | null = null;
    if (deadline && deadline.trim()) {
      const parsed = new Date(deadline);
      if (!isNaN(parsed.getTime())) deadlineDate = parsed;
    }
    const newCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        clientId: client.id,
        code,
        title,
        status: caseStatus,
        description: description ?? null,
        deadline: deadlineDate,
      },
    });
    return { success: true, data: { id: newCase.id, code: newCase.code, title: newCase.title }, message: `Дело "${title}" (${code}) создано для клиента "${client.name}"` };
  }

  if (toolName === "update_case") {
    const { caseId, field, value } = args as { caseId: string; field: string; value: string };
    // Workspace scoping — prevent IDOR
    const existingCase = await prisma.legalCase.findFirst({
      where: { id: caseId, workspaceId: wid },
    });
    if (!existingCase) {
      return { success: false, message: "Дело не найдено или недоступно" };
    }
    const updateData: Record<string, unknown> = {};
    if (field === "status") {
      const newStatus = ruToCaseStatus[value];
      if (!newStatus) return { success: false, message: `Неизвестный статус: "${value}". Допустимые: Новый, В работе, Суд, Пауза, Завершено` };
      updateData.status = newStatus;
    } else if (field === "deadline") {
      if (!value || !value.trim()) {
        updateData.deadline = null;
      } else {
        const parsed = new Date(value);
        if (isNaN(parsed.getTime())) return { success: false, message: `Неверный формат даты: "${value}"` };
        updateData.deadline = parsed;
      }
    } else {
      updateData[field] = value;
    }
    await prisma.legalCase.update({ where: { id: caseId }, data: updateData });
    return { success: true, data: { id: caseId }, message: `Дело обновлено: ${field} → "${value}"` };
  }

  return { success: false, message: `Инструмент "${toolName}" не найден` };
}

async function callGeminiWithFallback(
  systemInstruction: string,
  history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>,
  lastMessage: string,
) {
  let lastError: Error | null = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_KEY);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
      });
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastMessage);
      return { chat, result, response: result.response };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Try next model on 404/model not found
      if (!lastError.message.includes("404") && !lastError.message.includes("not found")) throw lastError;
    }
  }
  throw lastError ?? new Error("All Gemini models failed");
}

export async function POST(req: Request) {
  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY не настроен на сервере" }, { status: 503 });
  }

  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
    }

    // Validate request body
    let body: {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      confirmed?: boolean;
      pendingAction?: { toolName: string; args: Record<string, unknown> };
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
    }

    const { messages, confirmed, pendingAction } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Сообщения не переданы" }, { status: 400 });
    }

    // If user confirmed a pending action, execute it directly
    if (confirmed && pendingAction) {
      const result = await executeToolCall(wid, pendingAction.toolName, pendingAction.args ?? {});
      if (!result.success) {
        return NextResponse.json({ reply: `Не удалось выполнить: ${result.message}`, needsConfirmation: false });
      }
      return NextResponse.json({
        reply: result.message,
        toolUsed: pendingAction.toolName,
        toolResult: result.data,
        needsConfirmation: false,
      });
    }

    // Gemini requires history to start with a 'user' message
    const rawHistory = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" as const : "model" as const,
      parts: [{ text: m.content || " " }],
    }));
    const firstUserIdx = rawHistory.findIndex(m => m.role === "user");
    const history = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "user") {
      return NextResponse.json({ error: "Последнее сообщение должно быть от пользователя" }, { status: 400 });
    }
    const lastMessage = lastMsg.content?.trim() || " ";

    const { chat, response } = await callGeminiWithFallback(SYSTEM_PROMPT, history, lastMessage);

    // Check for function call
    const functionCalls = response.functionCalls?.();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const toolName = call.name;
      const args = (call.args ?? {}) as Record<string, unknown>;

      // Read-only tools execute immediately without confirmation
      if (toolName === "get_cases" || toolName === "get_clients" || toolName === "get_stats") {
        const toolResult = await executeToolCall(wid, toolName, args);
        let followUpText = toolResult.message;
        try {
          const followUp = await chat.sendMessage([{
            functionResponse: {
              name: toolName,
              response: { result: toolResult.data ?? toolResult.message },
            },
          }]);
          followUpText = followUp.response.text() || followUpText;
        } catch {
          // If follow-up fails, use raw message
        }
        return NextResponse.json({
          reply: followUpText,
          toolUsed: toolName,
          toolResult: toolResult.data,
          needsConfirmation: false,
        });
      }

      // Mutating tools need confirmation
      let confirmText: string;
      try {
        confirmText = response.text();
      } catch {
        confirmText = "";
      }
      if (!confirmText) confirmText = generateConfirmText(toolName, args);

      return NextResponse.json({
        reply: confirmText,
        toolUsed: toolName,
        pendingAction: { toolName, args },
        needsConfirmation: true,
      });
    }

    let replyText: string;
    try {
      replyText = response.text();
    } catch {
      replyText = "Не удалось получить ответ. Попробуйте ещё раз.";
    }

    return NextResponse.json({
      reply: replyText,
      needsConfirmation: false,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function generateConfirmText(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "create_case") {
    return `Создать дело «${args.title}» для клиента «${args.clientName}»${args.status ? ` (статус: ${args.status})` : ""}? Разрешаете?`;
  }
  if (toolName === "create_client") {
    return `Создать нового клиента «${args.name}»${args.phone ? ` (тел: ${args.phone})` : ""}? Разрешаете?`;
  }
  if (toolName === "update_case") {
    return `Обновить поле «${args.field}» → «${args.value}» в деле? Разрешаете?`;
  }
  return `Выполнить действие «${toolName}»? Разрешаете?`;
}
