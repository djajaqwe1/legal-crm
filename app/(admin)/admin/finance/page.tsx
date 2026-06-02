import Link from "next/link";
import { CrmShell } from "@/components/crm/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentImportForm } from "@/components/crm/payment-import-form";
import { WorkspaceAnalyticsSection } from "@/components/crm/workspace-analytics-section";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { getRecentPayments } from "@/lib/payments/import-csv";
import { ChevronRight, Home, Wallet } from "lucide-react";

export default async function FinancePage() {
  const wid = await resolveWorkspaceId();
  const payments = wid ? await getRecentPayments(wid, 20) : [];

  return (
    <CrmShell pageContext="Финансы: импорт платежей Rekassa/1С, аналитика по делам.">
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <Wallet className="h-3 w-3" />
            Финансы
          </span>
        </nav>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Финансы и платежи</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Импорт из Rekassa и 1С, привязка к делам, сводная аналитика
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-1 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Импорт CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentImportForm />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Последние транзакции</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">Транзакций пока нет. Загрузите CSV или добавьте вручную позже.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase text-zinc-400">
                      <th className="pb-2 pr-4">Дата</th>
                      <th className="pb-2 pr-4">Сумма</th>
                      <th className="pb-2 pr-4">Источник</th>
                      <th className="pb-2 pr-4">Дело</th>
                      <th className="pb-2">Описание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-zinc-50 dark:border-zinc-900">
                        <td className="py-2 pr-4 text-xs text-zinc-500">
                          {p.paidAt.toLocaleDateString("ru-RU")}
                        </td>
                        <td className="py-2 pr-4 font-mono font-medium">
                          {p.amount.toLocaleString("ru-RU")} ₸
                        </td>
                        <td className="py-2 pr-4 text-xs uppercase text-zinc-500">{p.source}</td>
                        <td className="py-2 pr-4 text-xs">
                          {p.legalCase ? (
                            <Link href={`/admin/cases/${p.legalCase.id}`} className="text-blue-600 hover:underline">
                              {p.legalCase.code}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="py-2 text-xs text-zinc-500 truncate max-w-[200px]">
                          {p.description ?? p.client?.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <WorkspaceAnalyticsSection />
    </CrmShell>
  );
}
