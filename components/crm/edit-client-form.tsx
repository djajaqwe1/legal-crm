"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import type { PortalClientAccess } from "@/lib/portal-client-status";

export type EditClientFormProps = {
  client: {
    id: string;
    name: string;
    manager: string;
    phone: string;
    email: string;
    portalAccess: PortalClientAccess;
  };
};

export function EditClientForm({ client }: EditClientFormProps) {
  const router = useRouter();
  const [name, setName] = useState(client.name);
  const [manager, setManager] = useState(client.manager);
  const [phone, setPhone] = useState(client.phone);
  const [email, setEmail] = useState(client.email);
  const [resetPortal, setResetPortal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          manager,
          phone,
          email,
          resetPortalAccess: resetPortal,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить.");
        return;
      }
      setResetPortal(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(ev) => void onSubmit(ev)} className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-zinc-500">Название / ФИО</label>
        <Input value={name} onChange={(ev) => setName(ev.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase text-zinc-500">Ответственный</label>
        <Input value={manager} onChange={(ev) => setManager(ev.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-500">Телефон</label>
          <Input value={phone} onChange={(ev) => setPhone(ev.target.value)} placeholder="+7 …" />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase text-zinc-500">E-mail (для ЛК)</label>
          <Input type="email" value={email} onChange={(ev) => setEmail(ev.target.value)} placeholder="client@…" />
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          className="mt-1"
          checked={resetPortal}
          onChange={(ev) => setResetPortal(ev.target.checked)}
        />
        <span>Сбросить доступ к личному кабинету (клиент заново пройдёт «Первый вход»).</span>
      </label>
      {client.portalAccess === "active" ? (
        <p className="text-xs text-zinc-500">
          Сейчас ЛК активен. Сброс отключит пароль; e-mail должен остаться в карточке для повторной активации.
        </p>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Сохранение…
          </>
        ) : (
          "Сохранить"
        )}
      </Button>
    </form>
  );
}
