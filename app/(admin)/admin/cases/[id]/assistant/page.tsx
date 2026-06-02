import Link from "next/link";
import { CrmShell } from "@/components/crm/shell";
import { CaseAiChat } from "@/components/crm/case-ai-chat";
import { CaseDocumentRow } from "@/components/crm/case-document-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCaseAssistantContext } from "@/lib/crm-repository";
import { ChevronRight, Home, Briefcase, MessageSquare, ExternalLink } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseAssistantPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getCaseAssistantContext(id);

  return (
    <CrmShell
      hideAssistant
      pageContext={context ? `AI-оператор по делу «${context.title}». Клиент: ${context.client}.` : "AI-оператор по делу."}
    >
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/admin/cases" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            Реестр дел
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/admin/cases/${id}`} className="hover:text-zinc-900 transition-colors">
            {context?.code || "Дело"}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            AI по делу
          </span>
        </nav>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {context ? context.title : "Дело не найдено"}
            </h2>
            <p className="text-sm text-zinc-500">
              AI ставит задачи, обновляет дело и работает с материалами — без ручного ввода
            </p>
          </div>
          {context && (
            <Link href={`/admin/cases/${id}`}>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Карточка дела
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>AI-оператор по делу</CardTitle>
          </CardHeader>
          <CardContent>
            {context ? (
              <CaseAiChat caseId={context.caseId} />
            ) : (
              <p className="text-sm text-zinc-500">Проверьте корректность ссылки на дело.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Документы</CardTitle>
              {context && (
                <Link href={`/admin/cases/${id}`} className="text-xs text-blue-600 hover:underline">
                  Загрузить
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {context?.documents && context.documents.length > 0 ? (
                <ul className="space-y-2">
                  {context.documents.map((doc, i) => (
                    <CaseDocumentRow key={i} name={doc.name} path={doc.path} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Документов пока нет.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Задачи</CardTitle>
              {context && (
                <Link href={`/admin/cases/${id}`} className="text-xs text-blue-600 hover:underline">
                  Управление
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {context?.tasks && context.tasks.length > 0 ? (
                <ul className="space-y-3">
                  {context.tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className={`mt-1 h-2 w-2 rounded-full ${task.completed ? "bg-green-500" : "bg-zinc-300"}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${task.completed ? "line-through text-zinc-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-zinc-400">{task.dueDate}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Задач пока нет — попросите AI их создать.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CrmShell>
  );
}
