import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmShell } from "@/components/crm/shell";
import { getContracts, getClients } from "@/lib/crm-repository";
import { CreateContractDialog } from "@/components/crm/create-contract-dialog";
import {
  FileText as FileIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Search,
  ChevronRight,
  Home,
  X,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplianceCheckButton } from "@/components/crm/compliance-check-button";

type IconComponent = React.ComponentType<{ className?: string }>;

const statusConfig: Record<string, { label: string; color: string; icon: IconComponent }> = {
  DRAFT: { label: "Черновик", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", icon: FileIcon },
  NEGOTIATION: { label: "На согласовании", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", icon: Clock },
  SIGNED: { label: "Подписан", color: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  EXPIRING: { label: "Истекает", color: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: AlertTriangle },
  ARCHIVED: { label: "Архив", color: "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400", icon: Archive },
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  NEGOTIATION: "На согласовании",
  SIGNED: "Подписан",
  EXPIRING: "Истекает",
  ARCHIVED: "Архив",
};

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string }>;
};

export default async function ContractsPage({ searchParams }: PageProps) {
  const { q, status: statusFilter } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [allContracts, clients] = await Promise.all([getContracts(), getClients()]);

  const contracts = allContracts.filter(c => {
    const matchesQuery = !query ||
      c.number.toLowerCase().includes(query) ||
      c.counterparty.toLowerCase().includes(query) ||
      (c.bin_iin ?? "").toLowerCase().includes(query) ||
      c.type.toLowerCase().includes(query);
    const matchesStatus = !statusFilter || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const hasFilter = !!query || !!statusFilter;

  return (
    <CrmShell pageContext="Страница реестра договоров. Здесь можно создавать, просматривать и проверять договоры.">
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <FileIcon className="h-3 w-3" />
            Договоры
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Реестр договоров</h2>
            <p className="text-sm text-zinc-500">Система управления жизненным циклом (CLM)</p>
          </div>
          <CreateContractDialog clients={clients} />
        </div>
      </header>

      {/* Search and status filter */}
      <form action="/admin/contracts" method="get" className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            className="pl-10 bg-white dark:bg-zinc-950"
            placeholder="Поиск по номеру, контрагенту или БИН..."
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter ?? ""}
          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <Button type="submit" variant="secondary" className="gap-2 bg-white dark:bg-zinc-900 shrink-0">
          <Search className="h-4 w-4" />
          Найти
        </Button>
        {hasFilter && (
          <Link href="/admin/contracts"
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shrink-0">
            <X className="h-3.5 w-3.5" />
            Сбросить
          </Link>
        )}
      </form>

      {hasFilter && (
        <p className="text-sm text-zinc-500 mb-4">
          Найдено договоров: <strong className="text-zinc-900 dark:text-zinc-100">{contracts.length}</strong>
          {statusFilter && <> · статус: <strong>{STATUS_LABELS[statusFilter] ?? statusFilter}</strong></>}
        </p>
      )}

      {/* Stats cards — always show totals, not filtered */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {[
          { label: "Всего договоров", value: allContracts.length, color: "text-zinc-900 dark:text-zinc-100" },
          { label: "Действующих", value: allContracts.filter(c => c.status === "SIGNED").length, color: "text-green-600" },
          { label: "Требуют внимания", value: allContracts.filter(c => c.status === "EXPIRING").length, color: "text-amber-600" },
          { label: "На согласовании", value: allContracts.filter(c => c.status === "NEGOTIATION").length, color: "text-blue-600" },
        ].map(stat => (
          <Card key={stat.label} className="border-zinc-200 dark:border-zinc-800 shadow-none dark:bg-zinc-900">
            <CardContent className="pt-6">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-none overflow-hidden">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
          <CardTitle className="text-lg font-semibold">
            {hasFilter ? `Результаты поиска (${contracts.length})` : "Все договоры"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Контрагент / БИН</TableHead>
                <TableHead className="hidden md:table-cell">Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="hidden lg:table-cell">Срок действия</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-zinc-500 italic">
                    {hasFilter
                      ? "По вашему запросу договоры не найдены. Попробуйте изменить фильтры."
                      : "Договоров пока нет. Нажмите «Новый договор», чтобы добавить."}
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract) => {
                  const config = statusConfig[contract.status] ?? statusConfig.DRAFT;
                  const Icon = config.icon;
                  return (
                    <TableRow key={contract.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      <TableCell className="font-mono text-sm font-medium">{contract.number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{contract.counterparty}</span>
                          {contract.bin_iin && (
                            <span className="text-xs text-zinc-400">{contract.bin_iin}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-zinc-600 dark:text-zinc-300">
                        {contract.type}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.color} flex w-fit items-center gap-1 border-0 shadow-none text-[10px] font-bold uppercase tracking-wider px-2 py-0.5`}>
                          <Icon className="h-2.5 w-2.5" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-zinc-500">
                        {contract.startDate.toLocaleDateString("ru-RU")}
                        {" — "}
                        {contract.endDate ? contract.endDate.toLocaleDateString("ru-RU") : "Бессрочно"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ComplianceCheckButton
                          contractId={contract.id}
                          contractNumber={contract.number}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
