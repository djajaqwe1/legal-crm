import { redirect } from "next/navigation";
import { readPortalPayload } from "@/lib/portal-session-server";
import { prisma } from "@/lib/prisma";
import { isDatabaseReachable } from "@/lib/db-health";
import { PortalPrivateNav } from "@/components/portal/portal-private-nav";

export default async function PortalPrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const p = await readPortalPayload();
  if (!p) {
    redirect("/portal/login");
  }

  // БД временно недоступна — показываем offline-страницу вместо краша
  if (!(await isDatabaseReachable())) {
    return (
      <div className="flex min-h-screen flex-col">
        <PortalPrivateNav clientName="Личный кабинет" />
        <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
          <div className="max-w-md space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl dark:bg-amber-900/30">
              🔌
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              Сервис временно недоступен
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              База данных временно не отвечает. Пожалуйста, попробуйте зайти через несколько минут.
              Ваша сессия сохранена.
            </p>
          </div>
        </div>
      </div>
    );
  }

  let client: { name: string } | null = null;
  try {
    client = await prisma.client.findFirst({
      where: { id: p.clientId, workspaceId: p.workspaceId },
      select: { name: true },
    });
  } catch {
    // ignore DB error, client stays null
  }
  if (!client) {
    redirect("/portal/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PortalPrivateNav clientName={client.name} />
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</div>
    </div>
  );
}
