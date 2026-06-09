import { prisma } from "@/lib/prisma";
import { CaseStatus } from "@/lib/generated-client";
import { caseStatusToRu } from "@/lib/case-status";
import { getAvailableProviders } from "@/lib/llm/router";

export async function buildWorkspaceSnapshot(workspaceId: string): Promise<string> {
  if (workspaceId === "offline-workspace") {
    const { getDashboardStats } = await import("@/lib/crm-repository");
    const stats = await getDashboardStats();
    const recent = stats.overdueCases
      .slice(0, 3)
      .map(c => `${c.code} «${c.title}»`)
      .join("; ");
    return [
      `Демо без PostgreSQL. Дел: ${stats.totalCases}, клиентов: ${stats.totalClients}, договоров: ${stats.totalContracts}, просрочено: ${stats.overdueCases.length}.`,
      recent ? `Примеры дел (мок): ${recent}.` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const [cases, clients, contracts, overdue, recentCases] = await Promise.all([
    prisma.legalCase.count({ where: { workspaceId } }),
    prisma.client.count({ where: { workspaceId } }),
    prisma.contract.count({ where: { workspaceId } }),
    prisma.legalCase.count({
      where: {
        workspaceId,
        deadline: { lt: new Date() },
        status: { not: CaseStatus.CLOSED },
      },
    }),
    prisma.legalCase.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { code: true, title: true, status: true, client: { select: { name: true } } },
    }),
  ]);

  const recent = recentCases
    .map(c => `${c.code} «${c.title}» (${caseStatusToRu[c.status] ?? c.status}, ${c.client?.name ?? "—"})`)
    .join("; ");

  return [
    `Дел: ${cases}, клиентов: ${clients}, договоров: ${contracts}, просрочено: ${overdue}.`,
    recent ? `Недавние дела: ${recent}.` : "Дел в базе пока нет.",
  ].join("\n");
}

export function buildJarvisSystemPrompt(snapshot: string, pageContext?: string): string {
  const providers = getAvailableProviders().join(", ") || "gemini";

  return `Ты — Джарвис, автономный AI-оператор CRM юридической фирмы ТОО «Конгломерат Алтай».
Ты работаешь как Cursor для юристов: юрист озвучивает задачу — ты выполняешь её через инструменты CRM.

СНИМОК CRM СЕЙЧАС:
${snapshot}
${pageContext ? `\nКОНТЕКСТ ЭКРАНА: ${pageContext}` : ""}

LLM-ПРОВАЙДЕРЫ: ${providers}

ПРАВИЛА РАБОТЫ (ОБЯЗАТЕЛЬНО):
1. Данные CRM (дела, клиенты, цифры) — ТОЛЬКО через инструменты. Никогда не выдумывай записи и статистику.
2. Юридические нормы РК — СНАЧАЛА вызови search_adilet, затем цитируй ТОЛЬКО найденные акты со ссылкой adilet.zan.kz. Без search_adilet — не называй номера статей.
3. Перед исками, претензиями, ходатайствами: search_adilet + get_case_context (если есть дело) → generate_document (с подтверждением).
4. Голосовые монологи юриста: разбери на шаги (клиент → дело → задачи → документы) и выполни цепочкой инструментов.
5. create/update/add_task/checklist/generate_document — объясни что сделаешь; система запросит «Разрешаете?» у юриста.
6. Удаление записей ЗАПРЕЩЕНО — не предлагай delete_*.
7. navigate_to — сразу открывает экран. После create_case/create_client — предложи navigate_to на карточку.
8. Отвечай по-русски, структурированно: что сделано, что нужно от юриста, следующий шаг.
9. «Да», «разрешаю» — подтверждение предыдущего действия (обрабатывается системой).`;
}
