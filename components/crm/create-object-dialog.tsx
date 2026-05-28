"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Loader2 } from "lucide-react";

type CreateObjectDialogProps = {
  clientId: string;
  clientLabel: string;
  trigger?: ReactNode;
};

export function CreateObjectDialog({
  clientId,
  clientLabel,
  trigger,
}: CreateObjectDialogProps) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/objects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, name }),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Не удалось создать объект");
      }
      setName("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1">
            <Building2 className="h-3.5 w-3.5" />
            Объект
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новый объект для «{clientLabel}»</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 pt-2">
          <p className="text-xs text-zinc-500">
            Объект — недвижимость, актив или проект клиента; к нему можно привязать дела.
          </p>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase text-zinc-500">
              Название
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр.: ТЦ «Алтай», склад №3"
              required
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="submit" className="w-full bg-zinc-900" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Сохранение…
              </>
            ) : (
              "Добавить объект"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
