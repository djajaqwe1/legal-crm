"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PortalConsultationForm() {
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/portal/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, phone }),
      });
      const data = (await res.json()) as { error?: string; code?: string };
      if (!res.ok) {
        setErr(data.error ?? "Ошибка.");
        setStatus("error");
        return;
      }
      setCode(data.code ?? null);
      setStatus("done");
      setMessage("");
    } catch {
      setErr("Сеть недоступна.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
        <p className="font-medium">Заявка создана.</p>
        {code ? <p className="mt-1">Номер дела в системе: {code}</p> : null}
        <p className="mt-2 text-emerald-800 dark:text-emerald-200">
          Юрист увидит запрос в CRM и свяжется с вами.
        </p>
        <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={() => setStatus("idle")}>
          Отправить ещё одну
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Запись на консультацию</h3>
      <p className="text-xs text-zinc-500">
        Создаётся отдельное дело в CRM — юрист обработает запрос в рабочем порядке.
      </p>
      <textarea
        className="min-h-[100px] w-full resize-y rounded-xl border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700"
        placeholder="Кратко опишите ситуацию и желаемое время связи"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Input
        className="rounded-xl"
        placeholder="Телефон (необязательно)"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      <Button
        type="button"
        className="rounded-full"
        disabled={status === "loading"}
        onClick={() => void submit()}
      >
        {status === "loading" ? "Отправка…" : "Отправить юристу"}
      </Button>
    </div>
  );
}
