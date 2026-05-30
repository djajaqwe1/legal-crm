"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  FileText, 
  Wand2, 
  Compass, 
  Gavel, 
  BookOpen,
  LogOut,
  ExternalLink,
  Bot,
} from "lucide-react";
import { ThemeToggle } from "@/components/crm/theme-toggle";

const navItems = [
  { label: "Джарвис ИИ", href: "/admin", icon: Bot },
  { label: "Дашборд", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Клиенты", href: "/admin/clients", icon: Users },
  { label: "Реестр дел", href: "/admin/cases", icon: Briefcase },
  { label: "Договоры", href: "/admin/contracts", icon: FileText },
  { label: "Конструктор документов", href: "/admin/documents-builder", icon: Wand2 },
  { label: "Агент-Стратег", href: "/admin/strategist", icon: Compass },
];

const integrationItems = [
  { label: "Судебный кабинет", href: "/admin/integration/sudkz", icon: Gavel },
  { label: "База Әділет", href: "/admin/integration/adilet", icon: BookOpen },
];

export function CrmSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setDbOnline(d?.db === true))
      .catch(() => setDbOnline(false));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };

  return (
    <aside className="flex flex-col border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex-1">
        <div className="flex items-center gap-2 px-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center dark:bg-zinc-100">
            <Briefcase className="h-5 w-5 text-white dark:text-zinc-900" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 leading-none">
              Conglomerate
            </p>
            <h1 className="text-lg font-bold tracking-tight">Legal CRM</h1>
          </div>
        </div>
        
        <div className="mt-10 space-y-8">
          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Меню</p>
            <nav className="mt-4 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                const isJarvis = item.href === "/admin";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isJarvis
                        ? isActive
                          ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-900/30"
                          : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                        : isActive
                          ? "bg-zinc-900 text-white shadow-md shadow-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${
                      isJarvis
                        ? isActive ? "text-white" : "text-blue-500 dark:text-blue-400"
                        : isActive ? "text-white dark:text-zinc-900" : "text-zinc-400"
                    }`} />
                    {item.label}
                    {isJarvis && !isActive && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-widest rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5">
                        AI
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Интеграции РК</p>
            <nav className="mt-4 space-y-1">
              {integrationItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-zinc-900 text-white shadow-md shadow-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isActive ? "text-white dark:text-zinc-900" : "text-zinc-400"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-1">
        {/* DB indicator */}
        {dbOnline !== null && (
          <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
            dbOnline
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          }`}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${
              dbOnline ? "bg-green-500" : "bg-amber-500 animate-pulse"
            }`} />
            {dbOnline ? "БД подключена" : "БД недоступна (демо)"}
          </div>
        )}

        {/* Portal link */}
        <Link
          href="/portal/login"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <ExternalLink className="h-4 w-4" />
          Кабинет клиента
        </Link>

        <ThemeToggle />

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Выход
        </button>
      </div>
    </aside>
  );
}
