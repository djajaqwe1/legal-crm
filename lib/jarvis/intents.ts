/** Прямой маршрут частых запросов — работает даже при сбое Gemini. */
import { formatLawyerDailyReply, type LawyerDailyBrief } from "@/lib/lawyer-daily";
import { isOperationalRequest } from "./case-intake";
import { JARVIS_CAPABILITIES_REPLY } from "./help";

export type JarvisIntent = {
  toolName: string;
  args: Record<string, unknown>;
};

export function matchJarvisIntent(text: string): JarvisIntent | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  if (
    /что\s+(?:ты|вы)(?:\s+[^\s?.!,]+){0,8}\s*(умеешь|можешь|делаешь)|чем\s+(?:ты|вы)\s+можешь|список\s+команд|как\s+пользоваться|^\s*помощь\s*$/.test(t)
  ) {
    return { toolName: "jarvis_help", args: {} };
  }

  // Составные задачи (новое дело, претензия, дедлайн) — только через агента / intake workflow
  if (isOperationalRequest(text)) return null;

  // Только чистый справочный запрос по закону — без создания дел и документов
  if (
    /^(найди|поиск|что говорит|какая статья|какой закон|покажи норм)/.test(t) ||
    (/стать[яи]\s+\d|кодекс|адилет|әділет|гпк|гк рк/.test(t) && !/дел|претенз|иск|создай|клиент/.test(t))
  ) {
    return { toolName: "search_adilet", args: { query: text.trim(), limit: 5 } };
  }
  if (/просроч|опозда|горящ|дедлайн.*(сегодня|истёк|истек)/.test(t)) {
    return { toolName: "get_overdue_cases", args: { limit: 10 } };
  }
  if (/рабоч(ий|его) день|на сегодня|мои задачи|что (делать|на) сегодня|план на день/.test(t)) {
    return { toolName: "get_lawyer_daily", args: {} };
  }
  if (/открыт(ые|ых) задач|все задачи|список задач/.test(t)) {
    return { toolName: "get_open_tasks", args: { limit: 15 } };
  }
  if (/аналитик|отч[её]т|выигрыш|исход|эффективност|консультац.*суд/.test(t)) {
    return { toolName: "get_analytics", args: {} };
  }
  if (/статистик|сколько (дел|клиент|договор)|сводк/.test(t)) {
    return { toolName: "get_stats", args: {} };
  }
  if (/последн.*\d*\s*дел|список дел|покажи дела|все дела/.test(t)) {
    const numMatch = t.match(/(\d+)/);
    const limit = numMatch ? Number(numMatch[1]) : 5;
    return { toolName: "get_cases", args: { limit: Math.min(limit, 20) } };
  }
  if (/открой.*договор|реестр договор/.test(t)) {
    return { toolName: "navigate_to", args: { page: "contracts" } };
  }
  if (/открой.*дел|реестр дел/.test(t)) {
    return { toolName: "navigate_to", args: { page: "cases" } };
  }
  if (/открой.*клиент|база клиент/.test(t)) {
    return { toolName: "navigate_to", args: { page: "clients" } };
  }
  if (/дашборд|панель управ/.test(t)) {
    return { toolName: "navigate_to", args: { page: "dashboard" } };
  }

  return null;
}

export function formatToolReply(
  toolName: string,
  data: unknown,
  message: string,
): string {
  if (toolName === "jarvis_help") {
    return JARVIS_CAPABILITIES_REPLY;
  }

  if (toolName === "get_overdue_cases" && Array.isArray(data)) {
    const rows = data as Array<{ code: string; title: string; client?: string; deadline?: string }>;
    if (!rows.length) return "Просроченных дел нет — всё в срок.";
    const list = rows
      .map(r => `• ${r.code} — ${r.title} (${r.client ?? "—"}, дедлайн ${r.deadline ?? "—"})`)
      .join("\n");
    return `Просроченных дел: ${rows.length}\n\n${list}`;
  }

  if (toolName === "get_cases" && Array.isArray(data)) {
    const rows = data as Array<{ code: string; title: string; client?: string; status?: string }>;
    if (!rows.length) return "Дел по запросу не найдено.";
    const list = rows.map(r => `• ${r.code} — ${r.title} (${r.client ?? "—"})`).join("\n");
    return `Найдено дел: ${rows.length}\n\n${list}`;
  }

  if (toolName === "get_stats" && data && typeof data === "object") {
    const d = data as { cases: number; clients: number; contracts: number; overdue: number };
    return `Статистика CRM:\n• Дела: ${d.cases}\n• Клиенты: ${d.clients}\n• Договоры: ${d.contracts}\n• Просрочено: ${d.overdue}`;
  }

  if (toolName === "get_analytics" && data && typeof data === "object" && "totals" in data) {
    const d = data as {
      totals: { cases: number; consultations: number; courtCases: number; documents: number; paymentsTotal: number };
    };
    return `Аналитика:\n• Всего дел: ${d.totals.cases}\n• Консультации: ${d.totals.consultations}\n• Судебные: ${d.totals.courtCases}\n• Документов: ${d.totals.documents}\n• Платежи: ${d.totals.paymentsTotal.toLocaleString("ru-RU")} ₸`;
  }

  if (toolName === "get_lawyer_daily" && data && typeof data === "object" && "summary" in data) {
    return formatLawyerDailyReply(data as LawyerDailyBrief);
  }

  if (toolName === "get_case_context" && data && typeof data === "object" && "code" in data) {
    const d = data as {
      code: string;
      title: string;
      status: string;
      client: string;
      deadline: string | null;
      tasks: Array<{ title: string; completed: boolean; dueDate: string | null }>;
      documents: Array<{ name: string }>;
    };
    const openTasks = d.tasks.filter(t => !t.completed);
    const taskLines = openTasks.length
      ? openTasks.map(t => `• ${t.title}${t.dueDate ? ` (${t.dueDate})` : ""}`).join("\n")
      : "• Все задачи выполнены";
    const docLines = d.documents.length
      ? d.documents.map(doc => `• ${doc.name}`).join("\n")
      : "• Нет прикреплённых файлов";
    return [
      `Дело ${d.code} — «${d.title}»`,
      `Клиент: ${d.client} · Статус: ${d.status}${d.deadline ? ` · Дедлайн: ${d.deadline}` : ""}`,
      "",
      `Документы (${d.documents.length}):`,
      docLines,
      "",
      `Открытые задачи (${openTasks.length}):`,
      taskLines,
    ].join("\n");
  }

  if (toolName === "get_open_tasks" && Array.isArray(data)) {
    const rows = data as Array<{ caseCode: string; title: string; dueDate?: string | null }>;
    if (!rows.length) return "Открытых задач нет.";
    return `Открытые задачи (${rows.length}):\n${rows.map(r => `• ${r.caseCode}: ${r.title}${r.dueDate ? ` — ${r.dueDate}` : ""}`).join("\n")}`;
  }

  if (toolName === "get_clients" && Array.isArray(data)) {
    const rows = data as Array<{ name: string; phone?: string; email?: string }>;
    if (!rows.length) return "Клиенты не найдены.";
    return rows.map(r => `• ${r.name}${r.phone ? ` · ${r.phone}` : ""}`).join("\n");
  }

  if (toolName === "search_adilet" && data && typeof data === "object" && "documents" in data) {
    const d = data as { documents: Array<{ title: string; articleRef?: string; url?: string; type?: string }> };
    if (!d.documents?.length) return "По запросу в базе Әділет ничего не найдено.";
    const list = d.documents
      .map(doc => `• ${doc.title}${doc.type ? ` (${doc.type})` : ""}${doc.articleRef ? ` — ${doc.articleRef}` : ""}`)
      .join("\n");
    return `Найдено в Әділет (${d.documents.length}):\n${list}`;
  }

  return message || "Готово.";
}
