import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseReachable } from "@/lib/db-health";
import { resolvePortalWorkspaceId } from "@/lib/portal-workspace";
import { PORTAL_SESSION_COOKIE, verifyPortalToken } from "@/lib/portal-session";

export type PortalApiOk = {
  ok: true;
  workspaceId: string;
  clientId: string;
  client: { id: string; name: string; email: string | null };
};

export async function getPortalApiContext(): Promise<
  PortalApiOk | { ok: false; response: NextResponse }
> {
  if (!(await isDatabaseReachable())) {
    return {
      ok: false,
      response: NextResponse.json({ error: "База данных недоступна." }, { status: 503 }),
    };
  }
  const expectedWid = await resolvePortalWorkspaceId();
  if (!expectedWid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Рабочее пространство не настроено." }, { status: 503 }),
    };
  }
  let token: string | undefined;
  try {
    token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value;
  } catch {
    token = undefined;
  }
  const payload = token ? verifyPortalToken(token) : null;
  if (!payload || payload.workspaceId !== expectedWid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Требуется вход в личный кабинет." }, { status: 401 }),
    };
  }
  const client = await prisma.client.findFirst({
    where: { id: payload.clientId, workspaceId: expectedWid },
    select: { id: true, workspaceId: true, name: true, email: true },
  });
  if (!client) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Сессия недействительна." }, { status: 401 }),
    };
  }
  return {
    ok: true,
    workspaceId: client.workspaceId,
    clientId: client.id,
    client: { id: client.id, name: client.name, email: client.email },
  };
}
