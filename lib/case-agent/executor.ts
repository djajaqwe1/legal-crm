import { prisma } from "@/lib/prisma";
import { ruToCaseStatus } from "@/lib/case-status";
import { CaseStatus } from "@/lib/generated-client";
import type { CaseAssistantContext } from "@/lib/crm-repository";

export type CaseToolResult = {
  success: boolean;
  message: string;
  data?: unknown;
  tasksCreated?: number;
};

function parseDueDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function executeCaseTool(
  workspaceId: string,
  caseId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CaseToolResult> {
  const legalCase = await prisma.legalCase.findFirst({
    where: { id: caseId, workspaceId },
    include: { tasks: true },
  });
  if (!legalCase) return { success: false, message: "Дело не найдено" };

  if (toolName === "list_tasks") {
    return {
      success: true,
      data: legalCase.tasks,
      message: legalCase.tasks.length
        ? `Задач: ${legalCase.tasks.length}`
        : "Задач пока нет",
    };
  }

  if (toolName === "add_task") {
    const { title, dueDate } = args as { title: string; dueDate?: string };
    if (!title?.trim()) return { success: false, message: "Название задачи обязательно" };
    await prisma.task.create({
      data: {
        legalCaseId: caseId,
        title: title.trim(),
        dueDate: parseDueDate(dueDate),
      },
    });
    return {
      success: true,
      tasksCreated: 1,
      message: `Задача добавлена: «${title.trim()}»`,
    };
  }

  if (toolName === "add_tasks") {
    const { tasks } = args as { tasks: Array<{ title: string; dueDate?: string }> };
    if (!Array.isArray(tasks) || !tasks.length) {
      return { success: false, message: "Передайте массив tasks" };
    }
    const rows = tasks.filter(t => t.title?.trim());
    if (!rows.length) return { success: false, message: "Нет валидных задач" };

    await prisma.task.createMany({
      data: rows.map(t => ({
        legalCaseId: caseId,
        title: t.title.trim(),
        dueDate: parseDueDate(t.dueDate),
      })),
    });

    return {
      success: true,
      tasksCreated: rows.length,
      data: rows.map(t => t.title.trim()),
      message: `Добавлено задач: ${rows.length}`,
    };
  }

  if (toolName === "update_case") {
    const { status, description } = args as { status?: string; description?: string };
    const data: { status?: CaseStatus; description?: string } = {};
    if (status && ruToCaseStatus[status]) data.status = ruToCaseStatus[status];
    if (description?.trim()) data.description = description.trim();
    if (!Object.keys(data).length) return { success: false, message: "Нечего обновлять" };

    await prisma.legalCase.update({ where: { id: caseId }, data });
    return { success: true, message: "Карточка дела обновлена" };
  }

  return { success: false, message: `Неизвестный инструмент: ${toolName}` };
}

export function buildCaseSystemPrompt(context: CaseAssistantContext): string {
  const docBlock = context.documents
    .map(d => {
      const text = d.extractedText?.trim();
      return text
        ? `• ${d.name}:\n${text.slice(0, 4000)}`
        : `• ${d.name} (файл в деле)`;
    })
    .join("\n\n");

  const tasksBlock = context.tasks.length
    ? context.tasks.map(t => `- [${t.completed ? "x" : " "}] ${t.title} (${t.dueDate})`).join("\n")
    : "Задач пока нет";

  return `Ты — AI-оператор CRM по конкретному делу. Ты НЕ консультант «на словах» — ты ВНОСИШЬ данные в систему через инструменты.

ДЕЛО:
- Код: ${context.code}
- Название: ${context.title}
- Клиент: ${context.client}
- Статус: ${context.status}
- Дедлайн: ${context.deadline}
${context.description ? `- Описание: ${context.description}` : ""}

ЗАДАЧИ В CRM:
${tasksBlock}

ДОКУМЕНТЫ:
${docBlock || "Документов нет"}

ПРАВИЛА:
1. Если юрист просит поставить/создать/внести задачи — вызывай add_tasks с 5–8 конкретными шагами по делу. Не проси «добавить перечень» — сам составь из названия дела и документов.
2. Если данных мало — всё равно предложи разумный план задач по типу дела (расторжение, аренда, иск и т.д.).
3. Отвечай по-русски, кратко: что сделал в CRM.
4. Не пиши «Insufficient data» — действуй через инструменты.
5. caseId уже известен системе — не спрашивай его.`;
}
