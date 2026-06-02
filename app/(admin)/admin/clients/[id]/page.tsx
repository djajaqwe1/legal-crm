import Link from "next/link";
import { notFound } from "next/navigation";
import { CrmShell } from "@/components/crm/shell";
import { CreateObjectDialog } from "@/components/crm/create-object-dialog";
import { ClientCaseTree, ClientCaseTreeLegend } from "@/components/crm/client-case-tree";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClientById } from "@/lib/crm-repository";
import { buildCaseTree } from "@/lib/case-tree";
import { CLIENT_CATEGORY_LABELS } from "@/lib/case-tree";
import { portalAccessFromClient, portalAccessLabel } from "@/lib/portal-client-status";
import { EditClientForm } from "@/components/crm/edit-client-form";
import {
  ChevronRight,
  Home,
  Users,
  Phone,
  Building2,
  Briefcase,
  Mail,
  Cloud,
} from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  const client = await getClientById(id);

  if (!client) {
    notFound();
  }

  const portalAccess = portalAccessFromClient({
    email: client.email,
    portalPasswordHash: client.portalPasswordHash,
  });

  const caseTree = buildCaseTree(client.cases);
  const categoryLabel = CLIENT_CATEGORY_LABELS[client.category] ?? "Клиент";

  return (
    <CrmShell pageContext={`Клиент: ${client.name}. Дел: ${client.cases.length}.`}>
      <header className="space-y-4 mb-8">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin/dashboard" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/admin/clients" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Users className="h-3 w-3" />
            Клиенты
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100">{client.name}</span>
        </nav>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-[10px]">{categoryLabel}</Badge>
              {client.folderGroup && (
                <Badge variant="secondary" className="text-[10px]">{client.folderGroup}</Badge>
              )}
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              {client.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">Папка клиента: объекты и дерево дел</p>
          </div>
          <CreateObjectDialog clientId={client.id} clientLabel={client.name} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Контакты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">Телефон</p>
                  <p>{client.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                <div>
                  <p className="text-xs font-medium uppercase text-zinc-500">Email</p>
                  <p>{client.email || "—"}</p>
                </div>
              </div>
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{portalAccessLabel(portalAccess)}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  ЛК:{" "}
                  <Link href="/portal/login" className="font-medium text-blue-600 hover:underline">
                    /portal/login
                  </Link>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">Ответственный</p>
                <p className="font-medium">{client.manager}</p>
              </div>
              {client.oneDriveUrl && (
                <div className="flex items-start gap-2">
                  <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <div>
                    <p className="text-xs font-medium uppercase text-zinc-500">OneDrive</p>
                    <a
                      href={client.oneDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      Открыть папку клиента
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Редактирование</CardTitle>
            </CardHeader>
            <CardContent>
              <EditClientForm
                client={{
                  id: client.id,
                  name: client.name,
                  manager: client.manager,
                  phone: client.phone ?? "",
                  email: client.email ?? "",
                  oneDriveUrl: client.oneDriveUrl,
                  portalAccess,
                }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-zinc-500" />
                Объекты
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {client.objects.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-zinc-500 italic">Объектов пока нет.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead className="text-right text-xs text-zinc-500">Создан</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.objects.map((obj) => (
                      <TableRow key={obj.id}>
                        <TableCell className="font-medium">{obj.name}</TableCell>
                        <TableCell className="text-right text-xs text-zinc-500">
                          {obj.createdAt.toLocaleDateString("ru-RU")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="h-5 w-5 text-zinc-500" />
                Дела клиента (дерево)
              </CardTitle>
            </CardHeader>
            <ClientCaseTreeLegend />
            <ClientCaseTree roots={caseTree} />
          </Card>
        </div>
      </div>
    </CrmShell>
  );
}
