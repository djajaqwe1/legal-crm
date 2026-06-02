import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWorkspaceAnalytics } from "@/lib/analytics/workspace-analytics";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { BarChart3 } from "lucide-react";

export async function WorkspaceAnalyticsSection() {
  const wid = await resolveWorkspaceId();
  if (!wid) return null;

  const data = await getWorkspaceAnalytics(wid);
  const { totals, byOutcome, byLawyer } = data;

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Аналитика практики
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Консультации", totals.consultations],
            ["Судебные дела", totals.courtCases],
            ["Документов", totals.documents],
            ["Клиентов", totals.clients],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
              <p className="text-xl font-bold tabular-nums">{value as number}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 px-3 py-2 text-sm">
          <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">Финансы</p>
          <p className="text-zinc-700 dark:text-zinc-300">
            Ожидается: <strong>{totals.expectedTotal.toLocaleString("ru-RU")} ₸</strong>
            {" · "}
            Оплачено по делам: <strong>{totals.paidOnCases.toLocaleString("ru-RU")} ₸</strong>
            {" · "}
            Транзакции (Rekassa/1С): <strong>{totals.paymentsTotal.toLocaleString("ru-RU")} ₸</strong>
          </p>
        </div>

        {Object.keys(byOutcome).length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-2">Исходы дел</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byOutcome).map(([label, count]) => (
                <span key={label} className="rounded-full bg-violet-50 dark:bg-violet-900/20 px-3 py-1 text-xs text-violet-800 dark:text-violet-200">
                  {label}: {count}
                </span>
              ))}
            </div>
          </div>
        )}

        {byLawyer.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-2">Нагрузка юристов</p>
            <div className="space-y-1">
              {byLawyer.slice(0, 6).map(row => (
                <div key={row.lawyer} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">{row.lawyer}</span>
                  <span className="font-mono font-bold">{row.cases}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
