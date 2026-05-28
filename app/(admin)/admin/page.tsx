import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmShell } from "@/components/crm/shell";
import { getClients, getContracts, getCases, getDashboardStats } from "@/lib/crm-repository";
import { statusColorMap } from "@/lib/crm-data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, FileText, Briefcase, ChevronRight, ArrowUpRight, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AiInsightCard } from "@/components/crm/ai-insight-card";
import type { DashboardStats } from "@/lib/crm-repository";

function AttentionCard({ stats }: { stats: DashboardStats }) {
  const items: { color: "orange" | "red" | "blue" | "zinc"; title: string; sub: string; href?: string }[] = [];

  for (const c of stats.overdueCases.slice(0, 3)) {
    items.push({
      color: "red",
      title: `Просрочено: ${c.code} — ${c.title}`,
      sub: `${c.client} · дедлайн ${c.deadline}`,
      href: `/admin/cases/${c.id}`,
    });
  }

  for (const c of stats.upcomingCases.slice(0, 2)) {
    items.push({
      color: "orange",
      title: `Дедлайн через 14 дней: ${c.code}`,
      sub: `${c.title} · ${c.client} · ${c.deadline}`,
      href: `/admin/cases/${c.id}`,
    });
  }

  for (const c of stats.courtCasesList.slice(0, 2)) {
    items.push({
      color: "orange",
      title: `В суде: ${c.code} — ${c.title}`,
      sub: `Клиент: ${c.client}`,
      href: `/admin/cases/${c.id}`,
    });
  }

  if (stats.openTasksCount > 0) {
    items.push({
      color: "zinc",
      title: `Открытых задач: ${stats.openTasksCount}`,
      sub: "По всем активным делам",
      href: "/admin/cases",
    });
  }

  if (stats.newLeadsToday > 0) {
    items.push({
      color: "blue",
      title: `Новых лидов сегодня: ${stats.newLeadsToday}`,
      sub: "Заявки через AI-виджет на сайте",
      href: "/admin/cases",
    });
  }

  const palette = {
    red: { border: "border-red-100", bg: "bg-red-50/50", title: "text-red-800", sub: "text-red-600" },
    orange: { border: "border-orange-100", bg: "bg-orange-50/50", title: "text-orange-800", sub: "text-orange-600" },
    blue: { border: "border-blue-100", bg: "bg-blue-50/50", title: "text-blue-800", sub: "text-blue-600" },
    zinc: { border: "border-zinc-200", bg: "bg-zinc-50", title: "text-zinc-800", sub: "text-zinc-500" },
  };

  return (
    <Card className="border-zinc-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Требуют внимания
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-zinc-400 italic text-center py-2">
            Нет срочных уведомлений — всё в порядке.
          </p>
        ) : (
          items.map((item, i) => {
            const p = palette[item.color];
            const inner = (
              <div className={`rounded-lg border ${p.border} ${p.bg} p-3`}>
                <p className={`text-xs font-bold ${p.title}`}>{item.title}</p>
                <p className={`text-[10px] ${p.sub} mt-1`}>{item.sub}</p>
              </div>
            );
            return item.href ? (
              <Link key={i} href={item.href} className="block hover:opacity-80 transition-opacity">
                {inner}
              </Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default async function Home() {
  const [cases, clients, contracts, stats] = await Promise.all([
    getCases(),
    getClients(),
    getContracts(),
    getDashboardStats(),
  ]);

  const activeCases = cases.filter(c => c.status !== "Завершено");
  const upcomingDeadlines = stats.upcomingCases.length + stats.overdueCases.length;

  return (
    <CrmShell>
      <header className="space-y-1 mb-8">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Система автоматизации ТОО «Конгломерат Алтай»</p>
        <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Панель управления</h2>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Активные дела</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{activeCases.length}</span>
                  {stats.newCasesLast30Days > 0 && !stats.isOffline && (
                    <span className="text-[10px] text-green-600 font-bold flex items-center">
                      <ArrowUpRight className="h-3 w-3" />
                      +{stats.newCasesLast30Days} за 30 дн
                    </span>
                  )}
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center dark:bg-blue-900/20">
                <Briefcase className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">База клиентов</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{clients.length}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center dark:bg-green-900/20">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Договоры CLM</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{contracts.length}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-50 flex items-center justify-center dark:bg-purple-900/20">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Срочные дедлайны</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-orange-600">{upcomingDeadlines}</span>
                </div>
              </div>
              <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center dark:bg-orange-900/20">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-bold">Последние активные дела</CardTitle>
            <Link href="/admin/cases">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 gap-1">
                Все дела
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/50">
                <TableRow>
                  <TableHead className="py-3">Клиент</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Дедлайн</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.slice(0, 5).map((item) => (
                  <TableRow key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                    <TableCell className="text-xs font-medium">{item.client}</TableCell>
                    <TableCell>
                      <Link href={`/admin/cases/${item.id}`} className="text-sm font-semibold hover:text-blue-600 transition-colors">
                        {item.caseTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColorMap[item.status] ?? statusColorMap["Новый"]} border-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-none`}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-medium text-zinc-500 uppercase">{item.deadline}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AttentionCard stats={stats} />
          <AiInsightCard stats={stats} />
        </div>
      </div>
    </CrmShell>
  );
}
