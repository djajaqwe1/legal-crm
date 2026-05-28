"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function CreateClientForm() {
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, manager, phone, email }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Не удалось создать клиента");
      }

      setName("");
      setManager("");
      setPhone("");
      setEmail("");
      setIsOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ошибка при создании клиента",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-zinc-900 text-white hover:bg-zinc-800">
          <UserPlus className="mr-2 h-4 w-4" />
          Новый клиент
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Регистрация нового клиента</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Название / ФИО</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="ТОО 'Компания' или Иванов И.И."
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Телефон</label>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+7 (___) ___ __ __"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-zinc-500">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="client@example.kz"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-500">Ответственный юрист</label>
            <Input
              value={manager}
              onChange={(event) => setManager(event.target.value)}
              placeholder="Рустем Айкимбаев"
              required
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <Button type="submit" className="w-full bg-zinc-900" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Создание...</>
            ) : (
              "Зарегистрировать"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
