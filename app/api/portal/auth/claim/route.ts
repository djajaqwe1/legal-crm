import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseReachable } from "@/lib/db-health";
import { resolvePortalWorkspaceId } from "@/lib/portal-workspace";
import { normalizePortalEmail, isValidPortalEmail } from "@/lib/portal-email";
import { hashPassword } from "@/lib/password";
import { applyPortalSessionCookie, signPortalSession, getPortalSessionSecretForSigning } from "@/lib/portal-session";

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  if (!(await isDatabaseReachable())) {
    return NextResponse.json({ error: "База данных недоступна." }, { status: 503 });
  }
  const wid = await resolvePortalWorkspaceId();
  if (!wid) {
    return NextResponse.json({ error: "Рабочее пространство не настроено." }, { status: 503 });
  }

  try {
    getPortalSessionSecretForSigning();
  } catch {
    return NextResponse.json(
      { error: "Сервер не настроен: задайте PORTAL_SESSION_SECRET (≥32 символов)." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? normalizePortalEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !isValidPortalEmail(email)) {
    return NextResponse.json({ error: "Укажите корректный e-mail." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Пароль не короче ${MIN_PASSWORD} символов.` },
      { status: 400 },
    );
  }

  const client = await prisma.client.findFirst({
    where: { workspaceId: wid, email },
    select: { id: true, portalPasswordHash: true },
  });
  if (!client) {
    return NextResponse.json(
      {
        error:
          "Клиент с таким e-mail не найден в базе компании. Убедитесь, что e-mail совпадает с указанным в договоре / переданным юристу.",
      },
      { status: 404 },
    );
  }
  if (client.portalPasswordHash) {
    return NextResponse.json(
      { error: "Доступ уже активирован. Используйте форму «Вход»." },
      { status: 409 },
    );
  }

  const portalPasswordHash = hashPassword(password);
  await prisma.client.update({
    where: { id: client.id },
    data: { portalPasswordHash },
  });

  const sessionToken = signPortalSession({ clientId: client.id, workspaceId: wid });
  const res = NextResponse.json({ ok: true });
  applyPortalSessionCookie(res, sessionToken);
  return res;
}
