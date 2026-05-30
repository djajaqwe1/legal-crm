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
  Filter as FilterIcon,
  ChevronRight,
  Home,
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ComplianceCheckButton } from "@/components/crm/compliance-check-button";

type IconComponent = React.ComponentType<{ className?: string }>;
const statusConfig: Record<string, { label: string; color: string; icon: IconComponent }> = {
  DRAFT: { label: "Черновик", color: "bg-zinc-100 text-zinc-600", icon: FileIcon },
  NEGOTIATION: { label: "На согласовании", color: "bg-blue-50 text-blue-600", icon: Clock },
  SIGNED: { label: "Подписан", color: "bg-green-50 text-green-600", icon: CheckCircle2 },
  EXPIRING: { label: "Истекает", color: "bg-amber-50 text-amber-600", icon: AlertTriangle },
  ARCHIVED: { label: "Архив", color: "bg-zinc-200 text-zinc-500", icon: Archive },
};

export default async function ContractsPage() {
  const [contracts, clients] = await Promise.all([getContracts(), getClients()]);

  return (
    <CrmShell>
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
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

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input className="pl-10 bg-white" placeholder="Поиск по номеру, контрагенту или БИН..." />
        </div>
        <Button variant="outline" className="bg-white gap-2">
          <FilterIcon className="h-4 w-4" />
          Фильтры
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{contracts.length}</div>
            <p className="text-xs text-zinc-500">Всего договоров</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {contracts.filter(c => c.status === "SIGNED").length}
            </div>
            <p className="text-xs text-zinc-500">Действующих</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">
              {contracts.filter(c => c.status === "EXPIRING").length}
            </div>
            <p className="text-xs text-zinc-500">Требуют внимания (30 дней)</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200 shadow-none">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {contracts.filter(c => c.status === "NEGOTIATION").length}
            </div>
            <p className="text-xs text-zinc-500">На согласовании</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200 bg-white shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg font-medium">Активные документы</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-400" />
            <input 
              placeholder="Поиск по номеру или БИН..." 
              className="w-full rounded-md border border-zinc-200 py-2 pl-8 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Номер</TableHead>
                <TableHead>Контрагент / БИН</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Срок действия</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-zinc-500">
                    Договоров пока нет. Оставьте заявку на лендинге для автоматического создания.
                  </TableCell>
                </TableRow>
              ) : (
                contracts.map((contract) => {
                  const config = statusConfig[contract.status] || statusConfig.DRAFT;
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{contract.counterparty}</span>
                          <span className="text-xs text-zinc-400">{contract.bin_iin || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{contract.type}</TableCell>
                      <TableCell>
                        <Badge className={`${config.color} flex w-fit items-center gap-1 border-0 shadow-none`}>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {contract.startDate.toLocaleDateString("ru-RU")} — {contract.endDate ? contract.endDate.toLocaleDateString("ru-RU") : "Бессрочно"}
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
