"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; name: string };

type ContractRow = {
  number: string;
  counterparty: string;
  type: string;
  clientId: string;
};

const CONTRACT_TYPES = [
  "Оказание юридических услуг",
  "Трудовой договор",
  "Договор поставки",
  "Аренда",
  "Иное",
];

const emptyRow = (): ContractRow => ({
  number: "",
  counterparty: "",
  type: "Оказание юридических услуг",
  clientId: "",
});

export function CreateContractDialog({ clients }: { clients: ClientOption[] }) {
  const [rows, setRows] = useState<ContractRow[]>([emptyRow()]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function updateRow(i: number, field: keyof ContractRow, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(i: number) {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    const valid = rows.filter(r => r.number.trim() && r.counterparty.trim());
    if (valid.length === 0) {
      setError("Заполните номер и контрагента хотя бы для одного договора");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      const payload = valid.map(r => ({
        number: r.number.trim(),
        counterparty: r.counterparty.trim(),
        type: r.type,
        clientId: r.clientId || undefined,
      }));

      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.length === 1 ? payload[0] : payload),
      });

      if (res.ok) {
        setIsOpen(false);
        setRows([emptyRow()]);
        router.refresh();
      } else {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Ошибка сохранения");
      }
    } catch {
      setError("Ошибка подключения");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={v => { setIsOpen(v); if (!v) { setRows([emptyRow()]); setError(""); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
          <Plus className="mr-2 h-4 w-4" />
          Новый договор
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Регистрация договоров</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rows.map((row, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 relative">
              {rows.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="absolute top-3 right-3 h-6 w-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Договор {rows.length > 1 ? `#${i + 1}` : ""}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Номер договора *</label>
                  <Input
                    placeholder="№123-2024"
                    value={row.number}
                    onChange={e => updateRow(i, "number", e.target.value)}
                    className="text-sm dark:bg-zinc-900"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Контрагент *</label>
                  <Input
                    placeholder="Компания или ФИО"
                    value={row.counterparty}
                    onChange={e => updateRow(i, "counterparty", e.target.value)}
                    className="text-sm dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Тип договора</label>
                  <select
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm"
                    value={row.type}
                    onChange={e => updateRow(i, "type", e.target.value)}
                  >
                    {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Клиент</label>
                  <select
                    className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm"
                    value={row.clientId}
                    onChange={e => updateRow(i, "clientId", e.target.value)}
                  >
                    <option value="">Не привязывать</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={addRow}
            className="w-full rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-3 text-sm text-zinc-400 hover:border-zinc-400 hover:text-zinc-600 dark:hover:border-zinc-500 dark:hover:text-zinc-300 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Добавить ещё договор
          </button>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
          )}

          <Button className="w-full" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            {rows.length > 1
              ? `Сохранить ${rows.filter(r => r.number && r.counterparty).length} договор(а)`
              : "Создать договор"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
