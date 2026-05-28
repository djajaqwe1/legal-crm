"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ClientOption = {
  id: string;
  name: string;
};

type CreateCaseFormProps = {
  clients: ClientOption[];
};

export function CreateCaseForm({ clients }: CreateCaseFormProps) {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Новый");
  const [deadline, setDeadline] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [objectId, setObjectId] = useState("");
  const [objects, setObjects] = useState<Array<{ id: string; name: string }>>([]);
  const [objectsLoading, setObjectsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!clientId) {
      window.setTimeout(() => {
        setObjects([]);
        setObjectId("");
      }, 0);
      return;
    }
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setObjectsLoading(true);
    }, 0);
    fetch(`/api/objects?clientId=${encodeURIComponent(clientId)}`)
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setObjects(data as Array<{ id: string; name: string }>);
          setObjectId("");
        } else {
          setObjects([]);
          setObjectId("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setObjects([]);
          setObjectId("");
        }
      })
      .finally(() => {
        if (!cancelled) setObjectsLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [clientId]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          title,
          status,
          deadline,
          clientId,
          objectId: objectId || null,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Не удалось создать дело");
      }

      setCode("");
      setTitle("");
      setStatus("Новый");
      setDeadline("");
      setObjectId("");
      setIsOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка при создании дела",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
          <Plus className="mr-2 h-4 w-4" />
          Создать новое дело
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Регистрация нового дела</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Код дела</label>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="LC-2026-100"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Дедлайн</label>
              <Input
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Название дела</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Введите название судебного спора"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Клиент</label>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
              required
            >
              <option value="" disabled>Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">
              Объект клиента <span className="font-normal normal-case text-zinc-400">(необязательно)</span>
            </label>
            <select
              value={objectId}
              onChange={(event) => setObjectId(event.target.value)}
              disabled={objectsLoading || !clientId}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-60"
            >
              <option value="">Без привязки к объекту</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            {objects.length === 0 && !objectsLoading && clientId && (
              <p className="text-[11px] text-zinc-400">
                У клиента пока нет объектов — добавьте их в разделе «Клиенты».
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Статус</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500"
            >
              <option>Новый</option>
              <option>В работе</option>
              <option>Суд</option>
              <option>Пауза</option>
              <option>Завершено</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button type="submit" className="w-full bg-zinc-900" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Создание...</>
            ) : (
              "Создать дело"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
