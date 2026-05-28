import Link from "next/link";
import { CrmShell } from "@/components/crm/shell";
import { CaseAiChat } from "@/components/crm/case-ai-chat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCaseAssistantContext } from "@/lib/crm-repository";

type PageProps = {
  params: Promise<{ id: string }>;
};

import { ChevronRight, Home, Briefcase, MessageSquare } from "lucide-react";

export default async function CaseAssistantPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getCaseAssistantContext(id);

  return (
    <CrmShell>
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
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
            AI Помощник
          </span>
        </nav>
        
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {context ? `AI Ассистент: ${context.title}` : "Дело не найдено"}
          </h2>
          <p className="text-sm text-zinc-500">
            Интеллектуальный анализ материалов дела и подготовка стратегии
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader>
            <CardTitle>Case AI Assistant (Gemini)</CardTitle>
          </CardHeader>
          <CardContent>
            {context ? (
              <CaseAiChat caseId={context.caseId} />
            ) : (
              <p className="text-sm text-zinc-500">Проверь корректность ссылки на дело.</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Файлы и документы</CardTitle>
            </CardHeader>
            <CardContent>
              {context?.documents && context.documents.length > 0 ? (
                <ul className="space-y-3">
                  {context.documents.map((doc, i) => (
                    <li key={i} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-sm truncate" title={doc.name}>{doc.name}</span>
                      </div>
                      <a 
                        href={doc.path} 
                        download 
                        className="text-xs text-blue-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Скачать
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Документы еще не добавлены.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Задачи</CardTitle>
            </CardHeader>
            <CardContent>
              {context?.tasks && context.tasks.length > 0 ? (
                <ul className="space-y-3">
                  {context.tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className={`mt-1 h-2 w-2 rounded-full ${task.completed ? 'bg-green-500' : 'bg-zinc-300'}`} />
                      <div className="flex-1">
                        <p className={`text-sm ${task.completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                          {task.title}
                        </p>
                        <p className="text-[10px] text-zinc-400">{task.dueDate}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Задач по делу нет.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CrmShell>
  );
}
