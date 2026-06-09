import type { JarvisAction, JarvisToolResult } from "./types";
import { JARVIS_CAPABILITIES_REPLY } from "./help";
import { getDashboardStats } from "@/lib/crm-repository";
import { isDatabaseReachable } from "@/lib/db-health";
import { MUTATING_TOOLS } from "./types";

/** Read-only и справочные инструменты без PostgreSQL (демо / dev). */
export async function executeOfflineJarvisTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<JarvisToolResult> {
  if (MUTATING_TOOLS.has(toolName) || toolName.startsWith("create_") || toolName.startsWith("update_") || toolName === "intake_new_case") {
    return {
      success: false,
      message:
        "Демо без базы данных: сохранение в CRM недоступно. Настройте DATABASE_URL в .env или откройте https://project-072fj.vercel.app/admin",
    };
  }

  if (toolName === "jarvis_help") {
    return { success: true, data: null, message: JARVIS_CAPABILITIES_REPLY };
  }

  if (toolName === "navigate_to") {
    const page = String(args.page ?? "dashboard");
    const paths: Record<string, string> = {
      dashboard: "/admin/dashboard",
      cases: "/admin/cases",
      clients: "/admin/clients",
      contracts: "/admin/contracts",
      jarvis: "/admin",
    };
    const path = paths[page] ?? "/admin/dashboard";
    return {
      success: true,
      data: { path },
      message: `Открываю: ${path}`,
      actions: [{ type: "navigate", path }],
    };
  }

  if (toolName === "get_stats") {
    const stats = await getDashboardStats();
    return {
      success: true,
      data: {
        cases: stats.totalCases,
        clients: stats.totalClients,
        contracts: stats.totalContracts,
        overdue: stats.overdueCases.length,
      },
      message: `Демо-данные: дел ${stats.totalCases}, клиентов ${stats.totalClients}`,
    };
  }

  if (toolName === "get_overdue_cases") {
    const stats = await getDashboardStats();
    const rows = stats.overdueCases.map(c => ({
      id: c.id,
      code: c.code,
      title: c.title,
      client: c.client,
      deadline: c.deadline,
    }));
    return {
      success: true,
      data: rows,
      message: rows.length ? `Просроченных (демо): ${rows.length}` : "Просроченных дел нет (демо)",
    };
  }

  if (toolName === "get_lawyer_daily") {
    const stats = await getDashboardStats();
    return {
      success: true,
      data: {
        overdue: stats.overdueCases.length,
        openTasks: stats.openTasksCount,
        mode: "offline",
      },
      message: `Демо-режим: просрочено ${stats.overdueCases.length}, открытых задач ${stats.openTasksCount}. Полный план — на prod.`,
    };
  }

  if (toolName === "search_adilet") {
    const { searchLegalGrounding } = await import("@/lib/legal-grounding/adilet-search");
    const query = String(args.query ?? "");
    const limit = typeof args.limit === "number" ? args.limit : 5;
    const result = await searchLegalGrounding(query, limit);
    return {
      success: true,
      data: result,
      message: result.documents.length
        ? `Найдено ${result.documents.length} акт(ов) в Әділет`
        : "По запросу ничего не найдено",
    };
  }

  return {
    success: false,
    message:
      "В демо-режиме эта команда недоступна. Подключите PostgreSQL или используйте prod: project-072fj.vercel.app/admin",
  };
}

export async function guardOfflineTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<JarvisToolResult | null> {
  if (await isDatabaseReachable()) return null;
  return executeOfflineJarvisTool(toolName, args);
}
