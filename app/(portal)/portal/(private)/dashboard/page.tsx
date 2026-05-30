import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readPortalPayload } from "@/lib/portal-session-server";
import { redirect } from "next/navigation";
import { caseStatusToRu } from "@/lib/case-status";
import { PortalConsultationForm } from "@/components/portal/portal-consultation-form";
import { ArrowRight, Briefcase, Calendar, Clock } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  "Новый": "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  "В работе": "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Суд": "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "Пауза": "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Завершено": "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

export default async function PortalDashboardPage() {
  const p = await readPortalPayload();
  if (!p) redirect("/portal/login");

  const client = await prisma.client.findFirst({
    where: { id: p.clientId, workspaceId: p.workspaceId },
    select: { name: true },
  });

  const cases = await prisma.legalCase.findMany({
    where: { workspaceId: p.workspaceId, clientId: p.clientId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      deadline: true,
      updatedAt: true,
      object: { select: { name: true } },
      tasks: { select: { completed: true } },
    },
  });

  const activeCases = cases.filter(c => caseStatusToRu[c.status] !== "Завершено");
  const doneCases = cases.filter(c => caseStatusToRu[c.status] === "Завершено");

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Header */}
      <div>
        <p className="text-sm text-zinc-500 mb-1">Добро пожаловать</p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {client?.name ?? "Личный кабинет"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Статусы обновляет юрист в CRM. ИИ-консультант доступен по каждому делу.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Всего дел", value: cases.length, icon: Briefcase },
          { label: "В работе", value: activeCases.length, icon: Clock },
          { label: "Завершено", value: doneCases.length, icon: Calendar },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <PortalConsultationForm />

      {/* Cases list */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-3">Ваши дела</h2>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          {cases.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500 italic">
              Пока нет дел в работе. Обратитесь к юристу для начала работы.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cases.map((c) => {
                const statusRu = caseStatusToRu[c.status] ?? "Новый";
                const totalTasks = c.tasks.length;
                const doneTasks = c.tasks.filter(t => t.completed).length;
                const now = Date.now();
                const deadlineDiff = c.deadline ? Math.ceil((c.deadline.getTime() - now) / 86400000) : null;
                const isOverdue = deadlineDiff !== null && deadlineDiff < 0;

                return (
                  <li key={c.id}>
                    <Link
                      href={`/portal/cases/${c.id}`}
                      className="group flex items-center justify-between px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-zinc-400">{c.code}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[statusRu] ?? STATUS_COLORS["Новый"]}`}>
                            {statusRu}
                          </span>
                        </div>
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{c.title}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          {c.object?.name && (
                            <span className="text-xs text-zinc-500">📍 {c.object.name}</span>
                          )}
                          {c.deadline && (
                            <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                              {isOverdue ? `⚠ Просрочено на ${-deadlineDiff!} дн` : `📅 Срок: ${c.deadline.toLocaleDateString("ru-RU")}`}
                            </span>
                          )}
                          {totalTasks > 0 && (
                            <span className="text-xs text-zinc-500">✓ {doneTasks}/{totalTasks} задач</span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">
                          Обновлено: {c.updatedAt.toLocaleDateString("ru-RU")}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-3" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/portal/chat" className="font-medium text-blue-600 hover:underline">
          Общий ИИ-консультант →
        </Link>
      </p>
    </main>
  );
}
