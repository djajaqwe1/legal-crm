import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaseStatus } from "@/lib/generated-client";
import { getPortalApiContext } from "@/lib/portal-api-context";

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function POST(request: Request) {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;

  let body: { message?: string; phone?: string };
  try {
    body = (await request.json()) as { message?: string; phone?: string };
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Опишите запрос не короче 10 символов." },
      { status: 400 },
    );
  }

  const desc = [
    "Запрос на консультацию из личного кабинета клиента.",
    "",
    message,
    phone ? `\nТелефон для связи: ${phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = `LK-${Date.now().toString(36)}-${randomSuffix()}`;
    try {
      const k = await prisma.legalCase.create({
        data: {
          workspaceId: ctx.workspaceId,
          clientId: ctx.clientId,
          code,
          title: "Запись на консультацию (личный кабинет)",
          description: desc,
          status: CaseStatus.NEW,
        },
        select: { id: true, code: true },
      });
      return NextResponse.json({ ok: true, caseId: k.id, code: k.code });
    } catch (e: unknown) {
      const s = String(e);
      if (s.includes("P2002") || s.includes("Unique")) continue;
      console.error("portal consultation:", e);
      return NextResponse.json({ error: "Не удалось создать заявку." }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Повторите попытку позже." }, { status: 503 });
}
