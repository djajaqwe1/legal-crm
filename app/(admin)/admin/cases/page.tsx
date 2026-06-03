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
import { CASE_KIND_LABELS } from "@/lib/case-tree";
import { CaseKind } from "@/lib/generated-client";
import {
  Search,
  Filter as FilterIcon,
  MessageSquare,
  ExternalLink,
  FileText,
  GitBranch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VoiceCreateButton } from "@/components/crm/voice-create-button";

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; kind?: string }>;
};

const STATUS_OPTIONS = ["Новый", "В работе", "Суд", "Пауза", "Завершено"];

const KIND_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Все типы" },
  { value: CaseKind.CONSULTATION, label: CASE_KIND_LABELS.CONSULTATION },
  { value: CaseKind.COURT, label: CASE_KIND_LABELS.COURT },
  { value: CaseKind.PROJECT, label: CASE_KIND_LABELS.PROJECT },
];

const KIND_BADGE_CLASS: Record<CaseKind, string> = {
  CONSULTATION: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  COURT: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200",
  PROJECT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
};

function deadlineBadge(deadlineStr: string) {
  if (deadlineStr === "Без срока") return null;
  const parts = deadlineStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!parts) return null;
  const d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: `Просрочено на ${-diff} дн`, color: "text-red-600" };
  if (diff === 0) return { label: "Сегодня", color: "text-red-600" };
  if (diff <= 7) return { label: `Осталось ${diff} дн`, color: "text-orange-600" };
  if (diff <= 14) return { label: `Осталось ${diff} дн`, color: "text-amber-600" };
  return null;
}

export default async function CasesPage({ searchParams }: PageProps) {
  const { q, status: statusFilter, kind: kindFilter } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const [allCases, clients] = await Promise.all([getCases(), getClients()]);

  const cases = allCases.filter((item) => {
    const matchesQuery =
      !query ||
      item.caseTitle.toLowerCase().includes(query) ||
      item.client.toLowerCase().includes(query) ||
      item.code.toLowerCase().includes(query) ||
      (item.objectLabel ?? "").toLowerCase().includes(query) ||
      (item.assignedLawyer ?? "").toLowerCase().includes(query);
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesKind = !kindFilter || item.kind === kindFilter;
    return matchesQuery && matchesStatus && matchesKind;
  });

  const hasFilter = !!query || !!statusFilter || !!kindFilter;
  const activeCount = allCases.filter((c) => c.status !== "Завершено").length;
  const kindCounts = {
    consultation: allCases.filter((c) => c.kind === CaseKind.CONSULTATION).length,
    court: allCases.filter((c) => c.kind === CaseKind.COURT).length,
    project: allCases.filter((c) => c.kind === CaseKind.PROJECT).length,
  };

  return (
    <CrmShell
      pageContext={`Реестр дел. Всего: ${allCases.length}, активных: ${activeCount}.`}
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">
            Реестр дел
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Реестр дел
          </h2>
        </div>
        <CreateCaseForm
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
        />
      </header>

      <div className="flex flex-wrap gap-2 mt-6">
        <Link
          href="/admin/cases"
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            !kindFilter
              ? "bg-zinc-900 text-white border-zinc-900"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          Все ({allCases.length})
        </Link>
        <Link
          href={`/admin/cases?kind=${CaseKind.CONSULTATION}`}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            kindFilter === CaseKind.CONSULTATION
              ? "bg-sky-600 text-white border-sky-600"
              : "border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300"
          }`}
        >
          {CASE_KIND_LABELS.CONSULTATION} ({kindCounts.consultation})
        </Link>
        <Link
          href={`/admin/cases?kind=${CaseKind.COURT}`}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            kindFilter === CaseKind.COURT
              ? "bg-violet-600 text-white border-violet-600"
              : "border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
          }`}
        >
          {CASE_KIND_LABELS.COURT} ({kindCounts.court})
        </Link>
        <Link
          href={`/admin/cases?kind=${CaseKind.PROJECT}`}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            kindFilter === CaseKind.PROJECT
              ? "bg-amber-600 text-white border-amber-600"
              : "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
          }`}
        >
          {CASE_KIND_LABELS.PROJECT} ({kindCounts.project})
        </Link>
      </div>

      <VoiceCreateButton />

      <form
        action="/admin/cases"
        method="get"
        className="flex flex-col gap-3 sm:flex-row sm:items-center mt-4"
      >
        {kindFilter ? <input type="hidden" name="kind" value={kindFilter} /> : null}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            className="bg-white pl-10 dark:bg-zinc-950"
            placeholder="Поиск по названию, клиенту, коду, объекту, юристу…"
            aria-label="Поиск по реестру дел"
          />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <select
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="">Все статусы</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            name="kind"
            defaultValue={kindFilter ?? ""}
            className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            {KIND_FILTER_OPTIONS.map((k) => (
              <option key={k.value || "all"} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" className="gap-2 bg-white dark:bg-zinc-900">
            <Search className="h-4 w-4" />
            Найти
          </Button>
          {hasFilter ? (
            <Link
              href="/admin/cases"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <FilterIcon className="h-3.5 w-3.5" />
              Сбросить
            </Link>
          ) : null}
        </div>
      </form>

      {hasFilter && (
        <p className="text-sm text-zinc-500 mt-3">
          Найдено дел:{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">{cases.length}</strong>
          {statusFilter && (
            <>
              {" "}
              · статус: <strong>{statusFilter}</strong>
            </>
          )}
          {kindFilter && (
            <>
              {" "}
              · тип:{" "}
              <strong>
                {CASE_KIND_LABELS[kindFilter as CaseKind] ?? kindFilter}
              </strong>
            </>
          )}
          {query && (
            <>
              {" "}
              · запрос: «{q}»
            </>
          )}
        </p>
      )}

      <Card className="border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden mt-4">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
              <TableRow>
                <TableHead className="w-[110px] py-4">Код</TableHead>
                <TableHead className="w-[100px]">Тип</TableHead>
                <TableHead>Клиент</TableHead>
                <TableHead className="hidden lg:table-cell">Объект</TableHead>
                <TableHead>Название</TableHead>
                <TableHead className="hidden md:table-cell">Связь</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Дедлайн</TableHead>
                <TableHead className="w-[90px] text-center hidden sm:table-cell">
                  <FileText className="h-3.5 w-3.5 inline" />
                </TableHead>
                <TableHead className="w-[90px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-zinc-500 italic">
                    {hasFilter
                      ? "Ничего не найдено. Попробуйте изменить фильтры."
                      : "Дела ещё не созданы. Нажмите «Создать новое дело»."}
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((item) => (
                  <TableRow
                    key={item.id}
                    className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-zinc-500">
                      {item.code}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${KIND_BADGE_CLASS[item.kind]} border-0 text-[9px] font-bold uppercase tracking-wider shadow-none`}
                      >
                        {item.kindLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
                      {item.client}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[120px] truncate text-sm text-zinc-500">
                      {item.objectLabel || "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/cases/${item.id}`}
                        className="font-semibold text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
                      >
                        <span className="line-clamp-2">{item.caseTitle}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </Link>
                      {item.assignedLawyer && (
                        <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                          {item.assignedLawyer}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {item.parentCaseCode ? (
                        <Link
                          href={`/admin/cases/${item.parentCaseId}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <GitBranch className="h-3 w-3" />
                          {item.parentCaseCode}
                        </Link>
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`${statusColorMap[item.status] ?? statusColorMap["Новый"]} border-0 shadow-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}
                        >
                          {item.status}
                        </Badge>
                        <CaseStatusControl caseId={item.id} currentStatus={item.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {item.deadline}
                        </span>
                        {(() => {
                          const badge = deadlineBadge(item.deadline);
                          return badge ? (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide ${badge.color}`}
                            >
                              {badge.label}
                            </span>
                          ) : null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className="text-xs font-mono text-zinc-500">
                        {item.documentCount > 0 ? item.documentCount : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/admin/cases/${item.id}/assistant`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="AI по делу"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/cases/${item.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Карточка">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
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
