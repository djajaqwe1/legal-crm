import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readPortalPayload } from "@/lib/portal-session-server";
import { redirect } from "next/navigation";
import { caseStatusToRu } from "@/lib/case-status";
import { PortalAiChatPanel } from "@/components/portal/portal-ai-chat-panel";
import { ArrowLeft, Calendar, CheckCircle2, Circle, MapPin } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "Новый": "bg-zinc-100 text-zinc-600",
  "В работе": "bg-blue-50 text-blue-700",
  "Суд": "bg-violet-50 text-violet-700",
  "Пауза": "bg-amber-50 text-amber-700",
  "Завершено": "bg-green-50 text-green-700",
};

type Params = { params: Promise<{ id: string }> };

export default async function PortalCasePage({ params }: Params) {
  const p = await readPortalPayload();
  if (!p) redirect("/portal/login");
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let row: any = null;

  try {
    row = await prisma.legalCase.findFirst({
      where: { id, workspaceId: p.workspaceId, clientId: p.clientId },
      include: {
        object: { select: { name: true } },
        tasks: { orderBy: { createdAt: "asc" } },
        documents: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
  } catch {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Link href="/portal/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
          <ArrowLeft className="h-3 w-3" />
          Все дела
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusRu = (caseStatusToRu as any)[row.status] ?? "Новый";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doneTasks = (row.tasks as any[]).filter((t: any) => t.completed).length;
  const totalTasks = row.tasks.length;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href="/portal/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
        <ArrowLeft className="h-3.5 w-3.5" />
        Все дела
      </Link>

      <header className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1">
            <span className="font-mono text-xs text-zinc-400">{row.code}</span>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{row.title}</h1>
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 ${STATUS_COLORS[statusRu] ?? STATUS_COLORS["Новый"]}`}>
            {statusRu}
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          {row.object?.name && (
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
              {row.object.name}
            </div>
          )}
          {row.deadline && (
            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <Calendar className="h-3.5 w-3.5 text-zinc-400" />
              Срок: {row.deadline.toLocaleDateString("ru-RU")}
            </div>
          )}
        </div>

        {row.description && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-4 text-sm text-zinc-700 dark:text-zinc-300">
            <p className="whitespace-pre-wrap leading-relaxed">{row.description}</p>
          </div>
        )}
      </header>

      {totalTasks > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-zinc-400" />
              Задачи по делу
            </h2>
            <span className="text-xs text-zinc-500">{doneTasks}/{totalTasks} выполнено</span>
          </div>

          {/* Progress bar */}
          <div className="mb-4 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0}%` }}
            />
          </div>

          <ul className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(row.tasks as any[]).map((t: any) => (
              <li key={t.id} className={`flex items-start gap-2.5 text-sm ${t.completed ? "opacity-60" : ""}`}>
                {t.completed
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  : <Circle className="h-4 w-4 text-zinc-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                }
                <span className={`${t.completed ? "line-through text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}>
                  {t.title}
                  {t.dueDate && <span className="ml-2 text-[11px] text-zinc-400">до {t.dueDate.toLocaleDateString("ru-RU")}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {row.documents.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 mb-3">Документы по делу</h2>
          <ul className="space-y-1.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(row.documents as any[]).map((doc: any) => (
              <li key={doc.id} className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-400">📄</span>
                <span>{doc.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PortalAiChatPanel
        endpoint={`/api/portal/cases/${row.id}/ai`}
        title="Вопросы по этому делу"
        subtitle="История видна только вам и команде юристов. Учитывается в дневном лимите ИИ."
      />
    </main>
  );
}
