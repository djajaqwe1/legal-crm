import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getLawyerDailyBrief } from "@/lib/lawyer-daily";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { AlertCircle, CalendarCheck, CheckSquare, ChevronRight } from "lucide-react";

const priorityClass = {
  high: "border-red-200 bg-red-50/80 dark:border-red-900/40 dark:bg-red-950/20",
  medium: "border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20",
  low: "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40",
};

export async function LawyerDailyPanel() {
  const wid = await resolveWorkspaceId();
  if (!wid) return null;

  let brief;
  try {
    brief = await getLawyerDailyBrief(wid);
  } catch {
    return null;
  }

  const hasWork =
    brief.overdue.length > 0 || brief.today.length > 0 || brief.upcomingDeadlines.length > 0;

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-emerald-600" />
            Мой рабочий день
          </CardTitle>
          <p className="text-sm text-zinc-500 mt-1">{brief.summary}</p>
        </div>
        <Link
          href="/admin/cases?status=В работе"
          className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-1 shrink-0"
        >
          Все дела
          <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent>
        {!hasWork ? (
          <p className="text-sm text-zinc-500 italic text-center py-4">
            Открытых срочных задач нет. Создайте дело или спросите Джарвис: «Что на сегодня?»
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {brief.overdue.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase text-red-600 flex items-center gap-1 mb-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Просрочено ({brief.overdue.length})
                </h3>
                <ul className="space-y-2">
                  {brief.overdue.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <Link
                        href={`/admin/cases/${item.caseId}`}
                        className={`block rounded-lg border p-2.5 text-xs hover:opacity-90 transition-opacity ${priorityClass.high}`}
                      >
                        <span className="font-mono font-bold">{item.caseCode}</span>
                        <p className="mt-0.5 text-zinc-800 dark:text-zinc-200">{item.title}</p>
                        {item.dueDate && (
                          <p className="text-[10px] text-red-600 mt-1">{item.dueDate}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <h3 className="text-xs font-bold uppercase text-zinc-600 flex items-center gap-1 mb-2">
                <CheckSquare className="h-3.5 w-3.5" />
                На сегодня ({brief.today.length})
              </h3>
              <ul className="space-y-2">
                {brief.today.length === 0 ? (
                  <li className="text-xs text-zinc-400 italic">Без задач на сегодня</li>
                ) : (
                  brief.today.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/admin/cases/${item.caseId}`}
                        className={`block rounded-lg border p-2.5 text-xs hover:opacity-90 ${priorityClass[item.priority]}`}
                      >
                        <span className="font-mono font-bold">{item.caseCode}</span>
                        <p className="mt-0.5">{item.title}</p>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-bold uppercase text-zinc-600 flex items-center gap-1 mb-2">
                <CalendarCheck className="h-3.5 w-3.5" />
                Дедлайны дел
              </h3>
              <ul className="space-y-2">
                {brief.upcomingDeadlines.length === 0 ? (
                  <li className="text-xs text-zinc-400 italic">На 7 дней вперёд — пусто</li>
                ) : (
                  brief.upcomingDeadlines.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/admin/cases/${item.caseId}`}
                        className={`block rounded-lg border p-2.5 text-xs hover:opacity-90 ${priorityClass[item.priority]}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold">{item.caseCode}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {item.dueDate}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate">{item.caseTitle}</p>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
