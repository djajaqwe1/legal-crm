"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "claim";

export function PortalLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbOffline, setDbOffline] = useState(false);

  async function submit() {
    setError(null);
    setDbOffline(false);
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/portal/auth/login" : "/api/portal/auth/claim";
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = data.error ?? "Ошибка запроса.";
        if (msg.includes("недоступна") || res.status === 503) {
          setDbOffline(true);
        } else {
          setError(msg);
        }
        return;
      }
      router.push("/portal/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Личный кабинет клиента
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Отдельный вход от панели юриста. Доступ только для клиентов, чей e-mail занесён в CRM компании.
        </p>
      </div>

      {dbOffline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Сервис в режиме предпросмотра
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Полноценный вход будет доступен после подключения базы данных.
            Пока вы можете посмотреть интерфейс кабинета в демо-режиме.
          </p>
          <Link
            href="/portal/demo"
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-800 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900 transition"
          >
            Открыть демо-кабинет →
          </Link>
        </div>
      )}

      <div className="flex gap-2 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
          onClick={() => { setMode("login"); setDbOffline(false); setError(null); }}
        >
          Вход
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "claim"
              ? "bg-white text-zinc-900 shadow dark:bg-zinc-800 dark:text-zinc-50"
              : "text-zinc-600 dark:text-zinc-400"
          }`}
          onClick={() => { setMode("claim"); setDbOffline(false); setError(null); }}
        >
          Первый вход
        </button>
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">E-mail</span>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.kz"
            className="rounded-xl"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">Пароль</span>
          <Input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "claim" ? "Не менее 8 символов" : "••••••••"}
            className="rounded-xl"
          />
        </label>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <Button
          type="button"
          className="w-full rounded-full"
          disabled={loading}
          onClick={() => void submit()}
        >
          {loading ? "Отправка…" : mode === "login" ? "Войти" : "Активировать и войти"}
        </Button>
        {mode === "claim" ? (
          <p className="text-xs leading-relaxed text-zinc-500">
            &laquo;Первый вход&raquo; доступен, если ваш e-mail уже указан у юриста в карточке клиента, но пароль для кабинета
            ещё не задавался.
          </p>
        ) : null}
      </div>

      <p className="text-center text-sm text-zinc-500">
        <Link href="/portal" className="font-medium text-blue-600 hover:underline">
          На главную кабинета
        </Link>
        {" · "}
        <Link href="/" className="font-medium text-blue-600 hover:underline">
          На сайт
        </Link>
      </p>
    </main>
  );
}

