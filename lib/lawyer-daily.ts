import { CaseStatus } from "./generated-client";
import { prisma } from "./prisma";
import { caseStatusToRu } from "./case-status";

export type LawyerDailyItem = {
  id: string;
  type: "task" | "case_deadline" | "overdue_case";
  caseId: string;
  caseCode: string;
  caseTitle: string;
  client: string;
  title: string;
  dueDate: string | null;
  priority: "high" | "medium" | "low";
  completed?: boolean;
};

export type LawyerDailyBrief = {
  today: LawyerDailyItem[];
  overdue: LawyerDailyItem[];
  upcomingDeadlines: LawyerDailyItem[];
  openTasksCount: number;
  summary: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("ru-RU");
}

function taskPriority(due: Date | null, now: Date): "high" | "medium" | "low" {
  if (!due) return "low";
  const diff = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return "high";
  if (diff <= 2) return "high";
  if (diff <= 7) return "medium";
  return "low";
}

/** Сводка рутины юриста: задачи на сегодня, просрочки, дедлайны дел. */
export async function getLawyerDailyBrief(
  workspaceId: string,
  lawyerName?: string,
): Promise<LawyerDailyBrief> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekAhead = new Date(now.getTime() + 7 * 86400000);

  const lawyerFilter = lawyerName?.trim()
    ? { assignedLawyer: { contains: lawyerName.trim(), mode: "insensitive" as const } }
    : {};

  const [openTasks, activeCases] = await Promise.all([
    prisma.task.findMany({
      where: {
        completed: false,
        legalCase: {
          workspaceId,
          status: { not: CaseStatus.CLOSED },
          ...lawyerFilter,
        },
      },
      include: {
        legalCase: {
          select: {
            id: true,
            code: true,
            title: true,
            assignedLawyer: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 50,
    }),
    prisma.legalCase.findMany({
      where: {
        workspaceId,
        status: { not: CaseStatus.CLOSED },
        deadline: { not: null },
        ...lawyerFilter,
      },
      include: { client: { select: { name: true } } },
      orderBy: { deadline: "asc" },
      take: 30,
    }),
  ]);

  const today: LawyerDailyItem[] = [];
  const overdue: LawyerDailyItem[] = [];

  for (const t of openTasks) {
    const due = t.dueDate;
    const item: LawyerDailyItem = {
      id: t.id,
      type: "task",
      caseId: t.legalCase.id,
      caseCode: t.legalCase.code,
      caseTitle: t.legalCase.title,
      client: t.legalCase.client.name,
      title: t.title,
      dueDate: due ? formatDate(due) : null,
      priority: taskPriority(due, now),
      completed: false,
    };

    if (due && due < todayStart) {
      overdue.push(item);
    } else if (due && due >= todayStart && due <= todayEnd) {
      today.push(item);
    } else if (!due) {
      today.push({ ...item, priority: "medium" });
    }
  }

  const upcomingDeadlines: LawyerDailyItem[] = [];

  for (const c of activeCases) {
    if (!c.deadline) continue;
    const item: LawyerDailyItem = {
      id: c.id,
      type: c.deadline < now ? "overdue_case" : "case_deadline",
      caseId: c.id,
      caseCode: c.code,
      caseTitle: c.title,
      client: c.client.name,
      title: `Дедлайн дела (${caseStatusToRu[c.status]})`,
      dueDate: formatDate(c.deadline),
      priority: c.deadline < now ? "high" : taskPriority(c.deadline, now),
    };

    if (c.deadline < todayStart) {
      overdue.push(item);
    } else if (c.deadline <= weekAhead) {
      upcomingDeadlines.push(item);
    }
  }

  overdue.sort((a, b) => (a.priority === "high" ? -1 : 1));

  const openTasksCount = openTasks.length;
  const summary =
    overdue.length > 0
      ? `Просрочено: ${overdue.length}. На сегодня задач: ${today.length}.`
      : today.length > 0
        ? `На сегодня ${today.length} задач, открытых всего: ${openTasksCount}.`
        : openTasksCount > 0
          ? `Открытых задач: ${openTasksCount}. Срочных просрочек нет.`
          : "Открытых задач нет — можно заняться новыми делами.";

  return {
    today: today.slice(0, 12),
    overdue: overdue.slice(0, 10),
    upcomingDeadlines: upcomingDeadlines.slice(0, 8),
    openTasksCount,
    summary,
  };
}

export async function getOpenTasksForWorkspace(
  workspaceId: string,
  limit = 20,
): Promise<LawyerDailyItem[]> {
  const tasks = await prisma.task.findMany({
    where: {
      completed: false,
      legalCase: { workspaceId, status: { not: CaseStatus.CLOSED } },
    },
    include: {
      legalCase: {
        select: {
          id: true,
          code: true,
          title: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: limit,
  });

  const now = new Date();
  return tasks.map((t) => ({
    id: t.id,
    type: "task" as const,
    caseId: t.legalCase.id,
    caseCode: t.legalCase.code,
    caseTitle: t.legalCase.title,
    client: t.legalCase.client.name,
    title: t.title,
    dueDate: t.dueDate ? formatDate(t.dueDate) : null,
    priority: taskPriority(t.dueDate, now),
  }));
}

export function formatLawyerDailyReply(brief: LawyerDailyBrief): string {
  const lines: string[] = [brief.summary, ""];

  if (brief.overdue.length) {
    lines.push("⚠ Просрочено:");
    for (const item of brief.overdue.slice(0, 8)) {
      lines.push(
        `• ${item.caseCode}: ${item.title}${item.dueDate ? ` (${item.dueDate})` : ""}`,
      );
    }
    lines.push("");
  }

  if (brief.today.length) {
    lines.push("📋 На сегодня:");
    for (const item of brief.today.slice(0, 8)) {
      lines.push(`• ${item.caseCode}: ${item.title}`);
    }
    lines.push("");
  }

  if (brief.upcomingDeadlines.length) {
    lines.push("📅 Дедлайны дел (7 дней):");
    for (const item of brief.upcomingDeadlines.slice(0, 5)) {
      lines.push(`• ${item.caseCode} — ${item.dueDate}`);
    }
  }

  return lines.join("\n").trim();
}
