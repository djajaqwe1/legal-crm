import { NextResponse } from "next/server";
import { createLead } from "@/lib/crm-repository";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = checkRateLimit(`public-lead:${ip}`, 20, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Слишком много заявок. Попробуйте позже." }, { status: 429 });
  }

  try {
    const { name, phone } = (await req.json()) as { name?: string; phone?: string };

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ ok: false, error: "Имя и телефон обязательны" }, { status: 400 });
    }

    // Сохраняем лид немедленно — НЕ ждём генерацию договора
    // createLead запускается без await через void чтобы не блокировать ответ
    const summary = `Заявка через форму на сайте`;

    // Отвечаем сразу, лид сохраняется в фоне
    void createLead({ name: name.trim(), phone: phone.trim(), summary });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
