"use client";

import { useState } from "react";
import { CrmShell } from "@/components/crm/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REGIONS, COURTS, INSTANCES, CASE_TYPES, SudKzCase } from "@/lib/integrations/sudkz";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Home, Gavel } from "lucide-react";
import Link from "next/link";

export default function SudKzIntegrationPage() {
  const [iinBin, setIinBin] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedCaseType, setSelectedCaseType] = useState("");
  const [results, setResults] = useState<SudKzCase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ title: string; description: string } | null>(null);

  async function handleSearch() {
    setIsLoading(true);
    setNotification(null);
    try {
      const response = await fetch("/api/integrations/sudkz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          iinBin, 
          caseNumber, 
          regionId: selectedRegion, 
          courtId: selectedCourt,
          instanceId: selectedInstance,
          caseType: selectedCaseType
        }),
      });
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync(caseData: SudKzCase) {
    try {
      const response = await fetch("/api/integrations/sudkz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SYNC", caseData }),
      });
      const data = await response.json();
      if (data.success) {
        setNotification(data.notification);
        // В реальном приложении мы бы обновили список дел в CRM
      }
    } catch (error) {
      console.error("Sync failed", error);
    }
  }

  return (
    <CrmShell>
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <Gavel className="h-3 w-3" />
            Судебный кабинет
          </span>
        </nav>

        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Интеграция: Судебный кабинет РК</h2>
          <p className="text-sm text-zinc-500">Поиск и синхронизация дел напрямую из государственных систем (sud.kz)</p>
        </div>
      </header>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Параметры поиска (Зеркало sud.kz)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">ИИН / БИН</label>
                <input
                  value={iinBin}
                  onChange={(e) => setIinBin(e.target.value)}
                  placeholder="12 цифр"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">Номер дела</label>
                <input
                  value={caseNumber}
                  onChange={(e) => setCaseNumber(e.target.value)}
                  placeholder="Напр: 7511-23-00-3/..."
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">Вид судопроизводства</label>
                <select
                  value={selectedCaseType}
                  onChange={(e) => setSelectedCaseType(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Все виды</option>
                  {CASE_TYPES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">Инстанция</label>
                <select
                  value={selectedInstance}
                  onChange={(e) => setSelectedInstance(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Все инстанции</option>
                  {INSTANCES.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">Область / Регион</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Выберите регион</option>
                  {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase text-zinc-500">Суд</label>
                <select
                  value={selectedCourt}
                  onChange={(e) => setSelectedCourt(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">Выберите суд</option>
                  {COURTS.filter(c => !selectedRegion || c.regionId === selectedRegion).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? "Поиск..." : "Найти в Судебном кабинете"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {notification && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            <strong>{notification.title}</strong> — {notification.description}
          </div>
        )}

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Найдено дел: {results.length}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер дела</TableHead>
                    <TableHead>Суд</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Участники</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((c) => (
                    <TableRow key={c.caseNumber}>
                      <TableCell className="font-medium">{c.caseNumber}</TableCell>
                      <TableCell>{c.court}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.participants.map(p => `${p.role}: ${p.name}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSync(c)}
                        >
                          Синхронизировать в CRM
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </CrmShell>
  );
}
