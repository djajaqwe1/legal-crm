import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readPortalPayload } from "@/lib/portal-session-server";

export default async function PortalHomePage() {
  const session = await readPortalPayload();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-16">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Клиентская зона</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Личный кабинет
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Просмотр дел, запись на консультацию, общий и контекстный ИИ-консультант с дневным лимитом. Вход отделён от
          панели юриста и не использует общую сессию администратора.
        </p>
      </div>

      {session ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
          <p className="font-medium">Вы уже вошли в кабинет.</p>
          <Link
            href="/portal/dashboard"
            className="mt-2 inline-flex font-semibold text-emerald-800 underline dark:text-emerald-200"
          >
            Перейти к делам →
          </Link>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/portal/login"
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
          )}
        >
          Вход или первый вход
        </Link>
        {session ? (
          <Link
            href="/portal/dashboard"
            className={cn(buttonVariants({ variant: "default", size: "lg" }), "rounded-full")}
          >
            Мои дела
          </Link>
        ) : null}
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full")}
        >
          На сайт компании
        </Link>
      </div>

      <ul className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        <li>Демо после сидирования: вход — e-mail из сида и пароль (см. комментарий в prisma/seed.ts).</li>
        <li>В production задайте PORTAL_SESSION_SECRET (≥32 символов) в окружении.</li>
      </ul>
    </main>
  );
}
