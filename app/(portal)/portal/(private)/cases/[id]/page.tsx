import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readPortalPayload } from "@/lib/portal-session-server";
import { redirect } from "next/navigation";
import { caseStatusToRu } from "@/lib/case-status";
import { PortalAiChatPanel } from "@/components/portal/portal-ai-chat-panel";

type Params = { params: Promise<{ id: string }> };

export default async function PortalCasePage({ params }: Params) {
  const p = await readPortalPayload();
  if (!p) redirect("/portal/login");
  const { id } = await params;

  let row: Awaited<ReturnType<typeof prisma.legalCase.findFirst>> & {
    object?: { name: string } | null;
    tasks?: { id: string; title: string; completed: boolean; dueDate: Date | null }[];
  } | null = null;

  try {
    row = await prisma.legalCase.findFirst({
      where: { id, workspaceId: p.workspaceId, clientId: p.clientId },
      include: {
        object: { select: { name: true } },
        tasks: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Link href="/portal/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
          ← Все дела
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Данные временно недоступны</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Попробуйте обновить страницу через несколько минут.
          </p>
        </div>
      </main>
    );
  }
  if (!row) notFound();

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/portal/dashboard" className="text-sm font-medium text-blue-600 hover:underline">
        ← Все дела
      </Link>
      <header className="space-y-1">
        <p className="font-mono text-xs text-zinc-500">{row.code}</p>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{row.title}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Статус: {caseStatusToRu[row.status]}</p>
        {row.object?.name ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Объект: {row.object.name}</p>
        ) : null}
        {row.deadline ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Срок: {row.deadline.toLocaleDateString("ru-RU")}
          </p>
        ) : null}
        {row.description ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
            <p className="whitespace-pre-wrap">{row.description}</p>
          </div>
        ) : null}
      </header>

      {row.tasks.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Задачи</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            {row.tasks.map((t) => (
              <li key={t.id}>
                {t.completed ? "✓ " : "○ "}
                {t.title}
                {t.dueDate ? ` — до ${t.dueDate.toLocaleDateString("ru-RU")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <PortalAiChatPanel
        endpoint={`/api/portal/cases/${row.id}/ai`}
        title="Вопросы по этому делу"
        subtitle="История видна только вам и команде юристов. Учитывается в дневном лимите ИИ."
      />
    </main>
  );
}
