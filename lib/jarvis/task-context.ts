import { prisma } from "@/lib/prisma";
import { resolveCaseQuery } from "./case-resolve";

/** Последняя открытая задача в деле — для «измени эту задачу». */
export async function getLatestOpenTaskQuery(
  workspaceId: string,
  caseQuery: string,
): Promise<string | null> {
  const resolved = await resolveCaseQuery(workspaceId, caseQuery);
  if (resolved.type !== "found") return null;
  const task = await prisma.task.findFirst({
    where: { legalCaseId: resolved.case.id, completed: false },
    orderBy: { createdAt: "desc" },
    select: { title: true },
  });
  return task?.title ?? null;
}

/** Из текста ответа Джarvis в чате — название недавно созданной/обновляемой задачи. */
export function extractTaskTitleFromChat(
  messages: Array<{ role: string; content: string }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const added = m.content.match(/Задача «([^»]+)» добавлена/i);
    if (added) return added[1].trim();
    const willAdd = m.content.match(/Добавлю задачу «([^»]+)»/i);
    if (willAdd) return willAdd[1].trim();
    const willUpdate = m.content.match(/Обновлю задачу «([^»]+)»/i);
    if (willUpdate) return willUpdate[1].trim();
    const updated = m.content.match(/Задача «([^»]+)» обновлена/i);
    if (updated) return updated[1].trim();
  }
  return null;
}
