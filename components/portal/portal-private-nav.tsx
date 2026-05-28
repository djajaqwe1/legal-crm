"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalPrivateNav({ clientName }: { clientName: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST", credentials: "include" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Личный кабинет</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {clientName}
          </span>
          <Link
            href="/portal/dashboard"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
          >
            Дела
          </Link>
          <Link
            href="/portal/chat"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "rounded-full")}
          >
            ИИ-консультант
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
        >
          Выйти
        </button>
      </div>
    </header>
  );
}
