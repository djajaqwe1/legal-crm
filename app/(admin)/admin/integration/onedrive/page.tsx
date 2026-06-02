import Link from "next/link";
import { CrmShell } from "@/components/crm/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getClients } from "@/lib/crm-repository";
import { CLIENT_CATEGORY_LABELS } from "@/lib/case-tree";
import { ChevronRight, Cloud, ExternalLink, Home, Users } from "lucide-react";

export default async function OneDriveIntegrationPage() {
  const clients = await getClients();
  const linked = clients.filter(
    (c) => "oneDriveUrl" in c && typeof c.oneDriveUrl === "string" && c.oneDriveUrl,
  );
  const unlinked = clients.filter(
    (c) => !("oneDriveUrl" in c) || !c.oneDriveUrl,
  );

  return (
    <CrmShell pageContext="Интеграция OneDrive: ссылки на папки клиентов">
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <Cloud className="h-3 w-3" />
            OneDrive
          </span>
        </nav>

        <div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Папки клиентов в OneDrive
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Структура «Физлица / Юрлица → клиент → дела» дублируется ссылками на облачные папки.
            Полная синхронизация через Microsoft Graph — в следующих версиях.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Как настроить</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
            <p>1. Создайте папку клиента в OneDrive или SharePoint.</p>
            <p>2. Скопируйте ссылку «Поделиться» на папку.</p>
            <p>
              3. В карточке клиента (раздел «Редактирование») вставьте URL в поле «Папка OneDrive».
            </p>
            <p className="text-xs text-zinc-500">
              Для автоматической загрузки PDF используйте Supabase Storage (переменные SUPABASE_URL и
              SUPABASE_SERVICE_ROLE_KEY в Vercel).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Статистика</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{linked.length}</p>
              <p className="text-zinc-500">с привязанной папкой</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{unlinked.length}</p>
              <p className="text-zinc-500">без ссылки</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-zinc-500" />
            Клиенты с папкой OneDrive
          </CardTitle>
        </CardHeader>
        <CardContent>
          {linked.length === 0 ? (
            <p className="text-sm text-zinc-500 italic py-4 text-center">
              Пока нет клиентов с привязанной папкой. Добавьте URL в карточке клиента.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {linked.map((client) => {
                const url = (client as { oneDriveUrl: string }).oneDriveUrl;
                const category =
                  "category" in client
                    ? CLIENT_CATEGORY_LABELS[
                        client.category as keyof typeof CLIENT_CATEGORY_LABELS
                      ]
                    : null;
                return (
                  <li
                    key={client.id}
                    className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/clients/${client.id}`}
                          className="font-medium hover:text-blue-600"
                        >
                          {client.name}
                        </Link>
                        {category && (
                          <Badge variant="outline" className="text-[10px]">
                            {category}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500 max-w-md">{url}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Открыть
                      </a>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Карточка
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </CrmShell>
  );
}
