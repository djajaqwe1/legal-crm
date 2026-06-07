import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safePdfFilename(title: string): string {
  const base = (title || "document")
    .replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_")
    .trim()
    .slice(0, 80) || "document";
  return `${base}.pdf`;
}

function loadFontBytes(): Buffer {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
    path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans.ttf"),
  ];
  for (const fp of candidates) {
    if (fs.existsSync(fp)) return fs.readFileSync(fp);
  }
  throw new Error("Font DejaVuSans.ttf not found");
}

function wrapLines(
  text: string,
  font: { widthOfTextAtSize: (t: string, size: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const { text, title } = (await request.json()) as { text?: string; title?: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(loadFontBytes());

    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;
    const bodySize = 12;
    const titleSize = 16;
    const lineHeight = 16;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    const titleText = title || "Документ";
    page.drawText(titleText, { x: margin, y: y - titleSize, size: titleSize, font });
    y -= titleSize + 24;

    const lines = wrapLines(text, font, bodySize, contentWidth);
    for (const line of lines) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      if (line) {
        page.drawText(line, { x: margin, y: y - bodySize, size: bodySize, font });
      }
      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const filename = safePdfFilename(title ?? "document");
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
        "Content-Length": String(pdfBytes.length),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "PDF generation failed";
    console.error("[download-pdf]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
