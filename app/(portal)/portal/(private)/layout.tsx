import { redirect } from "next/navigation";
import { readPortalPayload } from "@/lib/portal-session-server";
import { prisma } from "@/lib/prisma";
import { PortalPrivateNav } from "@/components/portal/portal-private-nav";

export default async function PortalPrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const p = await readPortalPayload();
  if (!p) {
    redirect("/portal/login");
  }

  const client = await prisma.client.findFirst({
    where: { id: p.clientId, workspaceId: p.workspaceId },
    select: { name: true },
  });
  if (!client) {
    redirect("/portal/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PortalPrivateNav clientName={client.name} />
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</div>
    </div>
  );
}
