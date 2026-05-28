"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Неверный пароль.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Не удалось выполнить вход. Проверьте соединение.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-zinc-100 bg-zinc-50 p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Вход в систему</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Доступ только для администратора ТОО «Конгломерат Алтай»
          </p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Пароль доступа
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-zinc-900 py-6 text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {isLoading ? "Проверка..." : "Войти в панель"}
          </Button>
        </form>

        <div className="flex items-center justify-center gap-2 pt-4 text-xs text-zinc-400">
          <Shield className="h-3 w-3" />
          <span>Защищенное соединение SSL</span>
        </div>
      </div>
    </div>
  );
}
