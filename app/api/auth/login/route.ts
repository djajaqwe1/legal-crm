import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_WORKSPACE_SLUG, ACTIVE_WORKSPACE_COOKIE } from "@/lib/workspace-scope";

const SESSION_COOKIE = "admin_session";
const SESSION_VALUE = "authorized";

function expectedPassword(): string | null {
  const fromEnv = process.env.ADMIN_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "rustem2026";
  }
  return null;
}

export async function POST(request: Request) {
  const expected = expectedPassword();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_PASSWORD не задан в окружении." },
      { status: 503 },
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  if (password !== expected) {
    return NextResponse.json({ ok: false, error: "Неверный пароль." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  try {
    const slug = process.env.DEFAULT_WORKSPACE_SLUG ?? DEFAULT_WORKSPACE_SLUG;
    const ws = await prisma.workspace.findUnique({ where: { slug } });
    if (ws) {
      res.cookies.set(ACTIVE_WORKSPACE_COOKIE, ws.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  } catch {
    /* БД может быть недоступна — сессия админа всё равно валидна */
  }
  return res;
}
