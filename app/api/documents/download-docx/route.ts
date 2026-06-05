import { NextResponse } from "next/server";

/** Word-совместимый экспорт через HTML (.doc) — без тяжёлых зависимостей. */
export async function POST(request: Request) {
  try {
    const { text, title } = (await request.json()) as { text?: string; title?: string };
    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const safeTitle = (title ?? "document").replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_");
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${safeTitle}</title></head>
<body style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
<h2 style="text-align:center">${safeTitle}</h2>
<div>${escaped}</div>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/msword; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.doc"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "DOCX export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
