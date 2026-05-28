"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; name: string };
export function CreateContractDialog({ clients }: { clients: ClientOption[] }) {
  const [number, setNumber] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [type, setType] = useState("Оказание юридических услуг");
  const [clientId, setClientId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  async function handleCreate() {
    if (!number || !counterparty) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, counterparty, type, clientId }),
      });
      if (res.ok) {
        setIsOpen(false);
        setNumber("");
        setCounterparty("");
        router.refresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800">
          <Plus className="mr-2 h-4 w-4" />
          Новый договор
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Регистрация договора</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Номер договора</label>
            <Input 
              placeholder="Напр: №123-2024" 
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Контрагент</label>
            <Input 
              placeholder="Название компании или ФИО" 
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Тип договора</label>
            <select 
              className="w-full rounded-md border border-zinc-200 p-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Оказание юридических услуг</option>
              <option>Трудовой договор</option>
              <option>Договор поставки</option>
              <option>Аренда</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Связать с клиентом</label>
            <select 
              className="w-full rounded-md border border-zinc-200 p-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Не привязывать</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={isLoading || !number || !counterparty}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Создать запись
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
