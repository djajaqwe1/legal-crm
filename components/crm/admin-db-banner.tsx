import { isDatabaseReachable } from "@/lib/db-health";

/** Плашка для сегмента /admin: не используется внутри client-only страниц. */
export async function AdminDbBanner() {
  const dbOk = await isDatabaseReachable();
  if (dbOk) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-50 lg:pl-[calc(280px+1.5rem)]"
    >
      <p className="font-semibold">Работа без PostgreSQL (демо-режим)</p>
      <p className="mt-1 max-w-4xl text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/85">
        <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/60">DATABASE_URL</code> недоступен — показаны
        мок-данные, запросы к БД не дублируются, чтобы не засорять консоль. Для полного CRUD поднимите PostgreSQL,
        затем <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/60">npx prisma db push</code> и{" "}
        <code className="rounded bg-amber-100/90 px-1 dark:bg-amber-900/60">npm run prisma:seed</code>.
      </p>
    </div>
  );
}
