import { getCaseDetails } from "@/lib/crm-repository";
import { CrmShell } from "@/components/crm/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { statusColorMap } from "@/lib/crm-data";
import { caseStatusToRu } from "@/lib/case-status";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AddTaskDialog, AddDocumentDialog, TaskItem, DocumentItem } from "@/components/crm/case-management-tools";
import { CaseStatusControl } from "@/components/crm/case-status-control";
import { CaseObjectControl } from "@/components/crm/case-object-control";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileSignature,
  FileText,
  Home,
  MessageSquare,
  User,
} from "lucide-react";


type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function CaseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const caseData = await getCaseDetails(id);

  if (!caseData) {
    return (
      <CrmShell>
        <div className="flex h-[400px] flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">Дело не найдено</h2>
          <Link href="/admin/cases" className="text-blue-600 hover:underline">
            Вернуться в реестр
          </Link>
        </div>
      </CrmShell>
    );
  }

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
          <span className="text-zinc-900 dark:text-zinc-100">{caseData.code}</span>
        </nav>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{caseData.title}</h2>
            <p className="text-sm text-zinc-500">
              Объект:{" "}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {caseData.object?.name ?? "не привязан"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
             <Link href={`/admin/cases/${id}/assistant`}>
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100">
                <MessageSquare className="mr-2 h-4 w-4" />
                AI Помощник
              </Button>
             </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-zinc-500" />
                Детали дела
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-zinc-500">Статус</p>
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColorMap[caseStatusToRu[caseData.status]] ?? statusColorMap["Новый"]} border-0`}>
                      {caseStatusToRu[caseData.status]}
                    </Badge>
                    <CaseStatusControl caseId={caseData.id} currentStatus={caseStatusToRu[caseData.status]} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-zinc-500">Дедлайн</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    {caseData.deadline ? caseData.deadline.toLocaleDateString("ru-RU") : "Без срока"}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-zinc-500">Клиент</p>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-zinc-400" />
                    {caseData.client.name}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase text-zinc-500">Код дела</p>
                  <p className="text-sm font-mono">{caseData.code}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs font-medium uppercase text-zinc-500">Объект клиента</p>
                  <CaseObjectControl
                    caseId={caseData.id}
                    clientId={caseData.clientId}
                    currentObjectId={caseData.objectId}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-zinc-500">Описание / Суть дела</p>
                <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  {caseData.description || "Описание отсутствует"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Задачи по делу */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-zinc-500" />
                Задачи
              </CardTitle>
              <AddTaskDialog caseId={id} />
            </CardHeader>
            <CardContent>
              {caseData.tasks.length > 0 ? (
                <div className="space-y-3">
                  {caseData.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-zinc-500 italic">
                  Задач пока нет. Добавьте первую задачу для контроля хода дела.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Сайдбар: Документы и Договоры */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-zinc-500" />
                Документы
              </CardTitle>
              <AddDocumentDialog caseId={id} />
            </CardHeader>
            <CardContent>
              {caseData.documents.length > 0 ? (
                <div className="space-y-2">
                  {caseData.documents.map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 italic text-center py-4">
                  Нет документов. Загрузите первый файл.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-zinc-500" />
                Связанные договоры
              </CardTitle>
            </CardHeader>
            <CardContent>
              {caseData.contracts.length > 0 ? (
                <ul className="space-y-3">
                  {caseData.contracts.map((contract) => (
                    <li key={contract.id} className="rounded-lg border border-zinc-100 p-3">
                      <p className="text-xs font-bold">{contract.number}</p>
                      <p className="text-[10px] text-zinc-500">{contract.type}</p>
                      <Badge variant="outline" className="mt-2 text-[8px] h-4">
                        {contract.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500 italic text-center py-4">Договоры не найдены</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CrmShell>
  );
}
