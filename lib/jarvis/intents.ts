/** Прямой маршрут частых запросов — работает даже при сбое Gemini. */
export type JarvisIntent = {
  toolName: string;
  args: Record<string, unknown>;
};

export function matchJarvisIntent(text: string): JarvisIntent | null {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  if (/просроч|опозда|горящ|дедлайн.*(сегодня|истёк|истек)/.test(t)) {
    return { toolName: "get_overdue_cases", args: { limit: 10 } };
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

  return message || "Готово.";
}
