import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readPortalPayload } from "@/lib/portal-session-server";
import { redirect } from "next/navigation";
import { caseStatusToRu } from "@/lib/case-status";
import { PortalConsultationForm } from "@/components/portal/portal-consultation-form";

export default async function PortalDashboardPage() {
  const p = await readPortalPayload();
  if (!p) redirect("/portal/login");

  const cases = await prisma.legalCase.findMany({
    where: { workspaceId: p.workspaceId, clientId: p.clientId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      deadline: true,
      object: { select: { name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Ваши дела</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Статусы обновляет юрист в CRM. ИИ по делу доступен на странице дела.
        </p>
      </div>

      <PortalConsultationForm />

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {cases.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">Пока нет дел в работе.</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/portal/cases/${c.id}`}
                  className="block px-4 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-xs text-zinc-500">{c.code}</span>
                    <span className="text-xs text-zinc-500">{caseStatusToRu[c.status]}</span>
                  </div>
                  <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{c.title}</p>
                  {c.object?.name ? (
                    <p className="mt-0.5 text-xs text-zinc-500">Объект: {c.object.name}</p>
                  ) : null}
                  {c.deadline ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      Срок: {c.deadline.toLocaleDateString("ru-RU")}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/portal/chat" className="font-medium text-blue-600 hover:underline">
          Общий ИИ-консультант
        </Link>
      </p>
    </main>
  );
}
