import { isDatabaseReachable } from "@/lib/db-health";

/** Плашка только в dev, когда БД недоступна. На prod не показываем — там должна быть живая Supabase. */
export async function AdminDbBanner() {
  if (process.env.NODE_ENV === "production") return null;

  const dbOk = await isDatabaseReachable();
  if (dbOk) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-200/80 bg-amber-950/90 px-4 py-2 text-xs text-amber-100 lg:pl-[calc(280px+1.5rem)]"
    >
      <span className="font-medium">Локально без БД</span>
      <span className="mx-2 opacity-50">·</span>
      <span className="opacity-90">
        Проверьте <code className="rounded bg-amber-900/60 px-1">.env</code> или тестируйте на{" "}
        <a href="https://project-072fj.vercel.app/admin" className="underline hover:text-white">
          project-072fj.vercel.app
        </a>
      </span>
    </div>
  );
}
