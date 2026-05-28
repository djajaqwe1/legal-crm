import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CaseStatusControl } from "@/components/crm/case-status-control";
import { CrmShell } from "@/components/crm/shell";
import { CreateCaseForm } from "@/components/crm/create-case-form";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCases, getClients } from "@/lib/crm-repository";
import { statusColorMap } from "@/lib/crm-data";
import { Search, Filter as FilterIcon, MoreHorizontal, MessageSquare, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CasesPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [allCases, clients] = await Promise.all([getCases(), getClients()]);

  const cases = query
    ? allCases.filter(
        (item) =>
          item.caseTitle.toLowerCase().includes(query) ||
          item.client.toLowerCase().includes(query) ||
          item.code.toLowerCase().includes(query) ||
          (item.objectLabel ?? "").toLowerCase().includes(query),
      )
    : allCases;

  return (
    <CrmShell>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">MVP / Контроль дел</p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Реестр дел</h2>
        </div>
        <CreateCaseForm
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        />
      </header>

      <form
        action="/admin/cases"
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            className="bg-white pl-10 dark:bg-zinc-950"
            placeholder="Поиск по названию, клиенту, коду или объекту…"
            aria-label="Поиск по реестру дел"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="submit" variant="secondary" className="gap-2 bg-white dark:bg-zinc-900">
            <Search className="h-4 w-4" />
            Найти
          </Button>
          {query ? (
            <Link
              href="/admin/cases"
              className="inline-flex h-8 shrink-0 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Сбросить
            </Link>
          ) : null}
          <Button type="button" variant="outline" className="bg-white gap-2 dark:bg-zinc-900">
            <FilterIcon className="h-4 w-4" />
            Фильтры
          </Button>
        </div>
      </form>

      {query && (
        <p className="text-sm text-zinc-500">
          По запросу «{q}» найдено дел: <strong>{cases.length}</strong>
        </p>
      )}

      <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
              <TableRow>
                <TableHead className="w-[120px] py-4">ID дела</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead className="hidden md:table-cell">Объект</TableHead>
                <TableHead>Название дела</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дедлайн</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-zinc-500 italic">
                    Дела ещё не созданы. Нажмите &laquo;Создать новое дело&raquo;, чтобы начать.
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((item) => (
                  <TableRow key={item.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <TableCell className="font-mono text-xs text-zinc-500">{item.code}</TableCell>
                    <TableCell className="font-medium text-zinc-700 dark:text-zinc-300">{item.client}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[140px] truncate text-sm text-zinc-500">
                      {item.objectLabel || "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/cases/${item.id}`}
                        className="font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                      >
                        {item.caseTitle}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={`${statusColorMap[item.status] ?? statusColorMap["Новый"]} border-0 shadow-none px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`}
                        >
                          {item.status}
                        </Badge>
                        <CaseStatusControl caseId={item.id} currentStatus={item.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.deadline}</span>
                        {item.deadline !== "Без срока" && (
                          <span className="text-[10px] text-zinc-500 uppercase">Осталось 5 дней</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/admin/cases/${item.id}/assistant`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
