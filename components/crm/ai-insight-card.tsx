"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, AlertTriangle, Clock, Scale, FileText, CheckCircle2, WifiOff } from "lucide-react";
import type { DashboardStats } from "@/lib/crm-repository";

type Props = { stats: DashboardStats };

export function AiInsightCard({ stats }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const overduePct =
    stats.totalCases > 0
      ? Math.round((stats.overdueCases.length / stats.totalCases) * 100)
      : 0;

  const closedPct =
    stats.totalCases > 0
      ? Math.round((stats.closedCases / stats.totalCases) * 100)
      : 0;

  const summaryText = buildSummary(stats);

  return (
    <Card className="border-zinc-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 py-4">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          Legal AI Инсайт
          {stats.isOffline && (
            <span title="Демо-режим" className="ml-auto">
              <WifiOff className="h-3 w-3 text-zinc-400" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <p className="text-xs leading-relaxed text-zinc-600 italic">&ldquo;{summaryText}&rdquo;</p>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4 text-[10px] font-bold uppercase"
            >
              Подробный отчёт
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                Аналитика портфеля дел
              </DialogTitle>
              <DialogDescription>
                {stats.isOffline
                  ? "Демо-режим: PostgreSQL недоступен, показаны тестовые данные"
                  : "Данные из CRM на текущий момент"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Ключевые метрики */}
              <div className="grid grid-cols-3 gap-4">
                <StatBlock label="Всего дел" value={String(stats.totalCases)} />
                <StatBlock label="Завершено" value={`${closedPct}%`} />
                <StatBlock label="В суде" value={String(stats.courtCases)} />
              </div>

              {/* Просроченные дела */}
              {stats.overdueCases.length > 0 && (
                <Section
                  icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                  title="Просроченные дела"
                  color="text-red-800"
                  bg="bg-red-50 border-red-100"
                >
                  <ul className="space-y-1 mt-2">
                    {stats.overdueCases.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs">
                        <Link
                          href={`/admin/cases/${c.id}`}
                          className="font-medium hover:text-blue-600 transition-colors truncate"
                        >
                          {c.code} — {c.title}
                        </Link>
                        <span className="text-red-600 font-mono ml-2 shrink-0">{c.deadline}</span>
                      </li>
                    ))}
                  </ul>
                  {overduePct > 0 && (
                    <p className="text-[10px] text-red-600 mt-2">
                      {overduePct}% дел от общего портфеля просрочено.
                    </p>
                  )}
                </Section>
              )}

              {/* Ближайшие дедлайны */}
              {stats.upcomingCases.length > 0 && (
                <Section
                  icon={<Clock className="h-5 w-5 text-amber-500" />}
                  title="Дедлайны ближайших 14 дней"
                  color="text-amber-800"
                  bg="bg-amber-50 border-amber-100"
                >
                  <ul className="space-y-1 mt-2">
                    {stats.upcomingCases.map((c) => (
                      <li key={c.id} className="flex items-center justify-between text-xs">
                        <Link
                          href={`/admin/cases/${c.id}`}
                          className="font-medium hover:text-blue-600 transition-colors truncate"
                        >
                          {c.code} — {c.title}
                        </Link>
                        <span className="text-amber-700 font-mono ml-2 shrink-0">{c.deadline}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Дела в суде */}
              {stats.courtCases > 0 && (
                <Section
                  icon={<Scale className="h-5 w-5 text-blue-500" />}
                  title="Судебные дела"
                  color="text-blue-800"
                  bg="bg-blue-50 border-blue-100"
                >
                  <p className="text-xs mt-1 text-blue-700">
                    {stats.courtCases}{" "}
                    {plural(stats.courtCases, "дело", "дела", "дел")} находится на стадии суда.
                    Убедитесь, что по каждому подготовлены актуальные процессуальные документы.
                  </p>
                </Section>
              )}

              {/* Задачи */}
              {stats.openTasksCount > 0 && (
                <Section
                  icon={<CheckCircle2 className="h-5 w-5 text-zinc-500" />}
                  title="Открытые задачи"
                  color="text-zinc-800"
                  bg="bg-zinc-50 border-zinc-100"
                >
                  <p className="text-xs mt-1 text-zinc-600">
                    {stats.openTasksCount} незакрытых{" "}
                    {plural(stats.openTasksCount, "задача", "задачи", "задач")} по всем делам.
                  </p>
                </Section>
              )}

              {stats.overdueCases.length === 0 &&
                stats.upcomingCases.length === 0 &&
                stats.openTasksCount === 0 && (
                  <p className="text-sm text-zinc-500 text-center py-4">
                    Всё в порядке — срочных дел и задач нет.
                  </p>
                )}

              {/* Следующий шаг */}
              {stats.urgentCase && (
                <div className="bg-zinc-900 text-white p-5 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <p className="text-xs font-bold uppercase tracking-widest">Приоритетное действие</p>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    Подготовьте документы по делу{" "}
                    <span className="text-white font-semibold">{stats.urgentCase.code}</span> —{" "}
                    {stats.urgentCase.title} ({stats.urgentCase.client}).
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Link
                      href={`/admin/cases/${stats.urgentCase.id}`}
                      className="flex-1"
                    >
                      <Button
                        variant="outline"
                        className="w-full bg-transparent border-zinc-600 text-zinc-200 hover:bg-zinc-800"
                      >
                        Открыть дело
                      </Button>
                    </Link>
                    <Link
                      href={`/admin/documents-builder?type=petition&prompt=${encodeURIComponent(
                        `Дело ${stats.urgentCase.code}: ${stats.urgentCase.title}. Клиент: ${stats.urgentCase.client}.`,
                      )}`}
                      className="flex-1"
                    >
                      <Button className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
                        Сгенерировать документ
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 text-center">
      <p className="text-[10px] uppercase font-bold text-zinc-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-zinc-900">{value}</p>
    </div>
  );
}

function Section({
  icon,
  title,
  color,
  bg,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: string;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex gap-4 p-4 rounded-xl border ${bg}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${color}`}>{title}</p>
        {children}
      </div>
    </div>
  );
}

function buildSummary(stats: DashboardStats): string {
  if (stats.isOffline) {
    return "Подключитесь к PostgreSQL для получения реальной аналитики по вашему портфелю дел.";
  }
  if (stats.totalCases === 0) {
    return "Портфель пуст. Добавьте первое дело, чтобы система начала отслеживать сроки и задачи.";
  }
  if (stats.overdueCases.length > 0) {
    return `Внимание: ${stats.overdueCases.length} ${plural(stats.overdueCases.length, "дело просрочено", "дела просрочено", "дел просрочено")}. Срочно проверьте приоритеты и обновите статусы.`;
  }
  if (stats.upcomingCases.length > 0) {
    return `${stats.upcomingCases.length} ${plural(stats.upcomingCases.length, "дело требует", "дела требуют", "дел требуют")} внимания в ближайшие 14 дней. Проверьте готовность документов.`;
  }
  if (stats.courtCases > 0) {
    return `${stats.courtCases} ${plural(stats.courtCases, "дело", "дела", "дел")} находится на стадии суда. Убедитесь в актуальности процессуальных документов.`;
  }
  return `Портфель: ${stats.activeCases} активных из ${stats.totalCases} дел, ${stats.openTasksCount} открытых задач. Всё в штатном режиме.`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
