import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
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

export async function POST(request: Request) {
  try {
    const { text, title } = (await request.json()) as { text?: string; title?: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const fontPath = path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf");
    const fontCandidates = [
      fontPath,
      path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf", "ttf", "DejaVuSans.ttf"),
      "C:\\Windows\\Fonts\\arial.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ];

    let resolvedFont: string | null = null;
    for (const fp of fontCandidates) {
      if (fs.existsSync(fp)) {
        resolvedFont = fp;
        break;
      }
    }

    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50 });

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      try {
        if (resolvedFont) doc.font(resolvedFont);
        doc.fontSize(16).text(title || "Документ", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(text, { align: "left", lineGap: 2 });
        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    const filename = safePdfFilename(title ?? "document");
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "PDF generation failed";
    console.error("[download-pdf]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
