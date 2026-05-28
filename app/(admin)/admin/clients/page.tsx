import { CrmShell } from "@/components/crm/shell";
import { CreateClientForm } from "@/components/crm/create-client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClients } from "@/lib/crm-repository";

type PageProps = { searchParams: Promise<{ q?: string }> };
import { CreateObjectDialog } from "@/components/crm/create-object-dialog";
import { portalAccessFromClient, portalAccessLabel } from "@/lib/portal-client-status";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

import { Phone, MessageSquare, ChevronRight, Home, Users as UsersIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ClientsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const allClients = await getClients();

  const clients = query
    ? allClients.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.phone ?? "").toLowerCase().includes(query) ||
          (c.email ?? "").toLowerCase().includes(query) ||
          c.manager.toLowerCase().includes(query),
      )
    : allClients;

  return (
    <CrmShell>
      <header className="space-y-4 mb-8">
        <nav className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
          <Link href="/admin" className="hover:text-zinc-900 transition-colors flex items-center gap-1">
            <Home className="h-3 w-3" />
            Дашборд
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
            <UsersIcon className="h-3 w-3" />
            Клиенты
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Клиентская база</h2>
            <p className="text-sm text-zinc-500">Управление контактами и историей взаимодействия</p>
          </div>
          <CreateClientForm />
        </div>
      </header>

      <form action="/admin/clients" method="get" className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            className="pl-10 bg-white dark:bg-zinc-950"
            placeholder="Поиск по имени, телефону, email или менеджеру..."
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button type="submit" variant="secondary" className="gap-2 bg-white dark:bg-zinc-900">
            <Search className="h-4 w-4" />
            Найти
          </Button>
          {query && (
            <Link
              href="/admin/clients"
              className="inline-flex h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
            >
              Сбросить
            </Link>
          )}
        </div>
      </form>
      {query && (
        <p className="text-sm text-zinc-500 mb-4">
          По запросу «{q}» найдено клиентов: <strong>{clients.length}</strong>
        </p>
      )}

      <Card className="border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader>
          <CardTitle>Список клиентов</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название / Контакты</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead className="whitespace-nowrap">ЛК клиента</TableHead>
                <TableHead className="text-right">Объекты</TableHead>
                <TableHead className="text-right">Активных дел</TableHead>
                <TableHead className="text-right">Дата создания</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => {
                const pa = portalAccessFromClient({
                  email: client.email,
                  portalPasswordHash:
                    "portalPasswordHash" in client
                      ? (client as { portalPasswordHash: string | null }).portalPasswordHash
                      : null,
                });
                return (
                <TableRow key={client.id}>
                  <TableCell>
                    <div>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="font-medium text-zinc-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                      >
                        {client.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <Phone className="h-3 w-3" />
                        <span>{client.phone || "Нет телефона"}</span>
                      </div>
                      {client.email ? (
                        <div className="mt-0.5 text-xs text-zinc-500">{client.email}</div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{client.manager}</TableCell>
                  <TableCell>
                    <Badge
                      variant={pa === "active" ? "default" : "outline"}
                      className={
                        pa === "active"
                          ? "bg-emerald-600 text-white hover:bg-emerald-600"
                          : pa === "pending"
                            ? "border-amber-300 text-amber-800 dark:text-amber-200"
                            : ""
                      }
                    >
                      {portalAccessLabel(pa)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span>{client._count.objects ?? 0}</span>
                      <CreateObjectDialog
                        clientId={client.id}
                        clientLabel={client.name}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{client._count.cases}</TableCell>
                  <TableCell className="text-right">
                    {client.createdAt 
                      ? new Date(client.createdAt).toLocaleDateString("ru-RU") 
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" title="Позвонить">
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" title="Написать">
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </CrmShell>
  );
}
