import { CaseKind, CourtInstance } from "./generated-client";
import { prisma } from "./prisma";

/** Идентификатор типового чеклиста для юриста */
export type CaseWorkflowId =
  | "consultation_intake"
  | "court_first_instance"
  | "court_appeal"
  | "project_documents"
  | "consultation_to_court"
  | "pretension_flow";

export type WorkflowTaskTemplate = {
  title: string;
  /** Через сколько дней от сегодня — срок задачи */
  dueDays?: number;
};

export type CaseWorkflowMeta = {
  id: CaseWorkflowId;
  label: string;
  description: string;
  /** Для каких типов дел подходит */
  kinds: CaseKind[];
};

export const CASE_WORKFLOW_CATALOG: CaseWorkflowMeta[] = [
  {
    id: "consultation_intake",
    label: "Консультация: приём дела",
    description: "Сбор документов, анализ, заключение, договор",
    kinds: [CaseKind.CONSULTATION],
  },
  {
    id: "court_first_instance",
    label: "Суд: первая инстанция",
    description: "Иск, госпошлина, подача, заседание",
    kinds: [CaseKind.COURT],
  },
  {
    id: "court_appeal",
    label: "Суд: апелляция / кассация",
    description: "Жалоба, сроки обжалования, новая инстанция",
    kinds: [CaseKind.COURT],
  },
  {
    id: "project_documents",
    label: "Проект документов",
    description: "ТЗ, черновик, согласование, финал",
    kinds: [CaseKind.PROJECT],
  },
  {
    id: "consultation_to_court",
    label: "Переход в суд",
    description: "После консультации — подготовка иска",
    kinds: [CaseKind.CONSULTATION, CaseKind.COURT],
  },
  {
    id: "pretension_flow",
    label: "Досудебная претензия",
    description: "Претензия, отправка, контроль ответа",
    kinds: [CaseKind.CONSULTATION, CaseKind.COURT, CaseKind.PROJECT],
  },
];

const WORKFLOW_TASKS: Record<CaseWorkflowId, WorkflowTaskTemplate[]> = {
  consultation_intake: [
    { title: "Зафиксировать запрос клиента и собрать документы", dueDays: 2 },
    { title: "Провести правовой анализ ситуации", dueDays: 3 },
    { title: "Подготовить письменное заключение / консультацию", dueDays: 5 },
    { title: "Согласовать стратегию и стоимость с клиентом", dueDays: 5 },
    { title: "Оформить договор оказания юридических услуг", dueDays: 7 },
  ],
  court_first_instance: [
    { title: "Собрать и систематизировать доказательства", dueDays: 7 },
    { title: "Подготовить исковое заявление", dueDays: 10 },
    { title: "Рассчитать госпошлину, подготовить квитанцию", dueDays: 10 },
    { title: "Подать иск в суд, зафиксировать номер производства", dueDays: 14 },
    { title: "Контроль принятия иска судом", dueDays: 17 },
    { title: "Подготовиться к первому судебному заседанию", dueDays: 21 },
    { title: "Уведомить клиента о ходе дела", dueDays: 3 },
  ],
  court_appeal: [
    { title: "Проанализировать решение суда первой инстанции", dueDays: 3 },
    { title: "Проверить процессуальные сроки обжалования", dueDays: 5 },
    { title: "Подготовить апелляционную / кассационную жалобу", dueDays: 10 },
    { title: "Подать жалобу, зафиксировать регистрацию", dueDays: 14 },
    { title: "Подготовиться к заседанию вышестоящей инстанции", dueDays: 21 },
  ],
  project_documents: [
    { title: "Уточнить ТЗ документа у клиента", dueDays: 2 },
    { title: "Подготовить черновик документа", dueDays: 5 },
    { title: "Согласовать черновик с клиентом", dueDays: 7 },
    { title: "Внести правки и подготовить финальную версию", dueDays: 10 },
    { title: "Организовать подписание / отправку документа", dueDays: 12 },
  ],
  consultation_to_court: [
    { title: "Перенести материалы консультации в судебное дело", dueDays: 1 },
    { title: "Оценить перспективы и риски судебного спора", dueDays: 2 },
    { title: "Согласовать с клиентом переход в суд", dueDays: 3 },
  ],
  pretension_flow: [
    { title: "Подготовить досудебную претензию", dueDays: 5 },
    { title: "Направить претензию контрагенту (почта / курьер / e-mail)", dueDays: 7 },
    { title: "Зафиксировать дату отправки и срок ответа (30 дней)", dueDays: 7 },
    { title: "Контроль ответа на претензию", dueDays: 30 },
    { title: "При отказе — подготовить иск / эскалация", dueDays: 35 },
  ],
};

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

export function getWorkflowTasks(workflowId: CaseWorkflowId): WorkflowTaskTemplate[] {
  return WORKFLOW_TASKS[workflowId] ?? [];
}

export function resolveDefaultWorkflow(
  kind: CaseKind,
  courtInstance?: CourtInstance | null,
): CaseWorkflowId {
  if (kind === CaseKind.CONSULTATION) return "consultation_intake";
  if (kind === CaseKind.PROJECT) return "project_documents";
  if (courtInstance === CourtInstance.APPEAL || courtInstance === CourtInstance.CASSATION) {
    return "court_appeal";
  }
  return "court_first_instance";
}

export function workflowsForCase(kind: CaseKind): CaseWorkflowMeta[] {
  return CASE_WORKFLOW_CATALOG.filter((w) => w.kinds.includes(kind));
}

export type ApplyWorkflowResult = {
  workflowId: CaseWorkflowId;
  created: number;
  skipped: number;
  titles: string[];
};

/** Создаёт типовой чеклист задач; дубликаты по названию пропускает. */
export async function applyCaseWorkflow(
  caseId: string,
  workflowId: CaseWorkflowId,
  options?: { workspaceId?: string },
): Promise<ApplyWorkflowResult> {
  const templates = getWorkflowTasks(workflowId);
  if (!templates.length) {
    return { workflowId, created: 0, skipped: 0, titles: [] };
  }

  const legalCase = await prisma.legalCase.findFirst({
    where: {
      id: caseId,
      ...(options?.workspaceId ? { workspaceId: options.workspaceId } : {}),
    },
    include: { tasks: { select: { title: true } } },
  });

  if (!legalCase) {
    throw new Error("CASE_NOT_FOUND");
  }

  const existing = new Set(legalCase.tasks.map((t) => normalizeTitle(t.title)));
  const now = new Date();
  const toCreate: { title: string; dueDate: Date | null }[] = [];
  let skipped = 0;

  for (const tpl of templates) {
    if (existing.has(normalizeTitle(tpl.title))) {
      skipped++;
      continue;
    }
    toCreate.push({
      title: tpl.title,
      dueDate: tpl.dueDays != null ? addDays(now, tpl.dueDays) : null,
    });
    existing.add(normalizeTitle(tpl.title));
  }

  if (toCreate.length) {
    await prisma.task.createMany({
      data: toCreate.map((row) => ({
        legalCaseId: caseId,
        title: row.title,
        dueDate: row.dueDate,
      })),
    });
  }

  return {
    workflowId,
    created: toCreate.length,
    skipped,
    titles: toCreate.map((t) => t.title),
  };
}

/** Авто-чеклист при создании дела (без дублей). */
export async function autoApplyCaseWorkflow(
  caseId: string,
  kind: CaseKind,
  courtInstance?: CourtInstance | null,
  workspaceId?: string,
): Promise<ApplyWorkflowResult | null> {
  const workflowId = resolveDefaultWorkflow(kind, courtInstance);
  const result = await applyCaseWorkflow(caseId, workflowId, { workspaceId });
  if (result.created === 0 && result.skipped === 0) return null;
  return result;
}
