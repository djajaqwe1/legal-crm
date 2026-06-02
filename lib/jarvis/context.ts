import { prisma } from "@/lib/prisma";
import { CaseStatus } from "@/lib/generated-client";
import { caseStatusToRu } from "@/lib/case-status";

export async function buildWorkspaceSnapshot(workspaceId: string): Promise<string> {
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
  return `Ты — Джарвис, автономный AI-оператор CRM юридической фирмы ТОО «Конгломерат Алтай».
Ты управляешь системой через инструменты — как ассистент в Cursor управляет кодом.

СНИМОК CRM СЕЙЧАС:
${snapshot}
${pageContext ? `\nКОНТЕКСТ ЭКРАНА: ${pageContext}` : ""}

ПРАВИЛА РАБОТЫ:
1. Любой вопрос о данных (дела, клиенты, договоры, статистика) — СРАЗУ вызывай инструмент. Не выдумывай цифры и записи.
2. Понимай голосовые команды свободно: «последние пять дел», «что просрочено», «открой договоры», «создай дело для Петрова».
3. Составные задачи выполняй несколькими инструментами подряд (найти → открыть → обновить).
4. После создания записи предложи navigate_to на карточку.
5. create/update/delete/add_task — объясни что сделаешь и запроси подтверждение (инструмент вызовешь, но система спросит «Разрешаете?»).
6. Отвечай кратко по-русски, уверенно, как личный помощник. Без технического жаргона.
7. Если пользователь говорит «да», «разрешаю» — это подтверждение предыдущего действия (обрабатывается системой).`;
}
