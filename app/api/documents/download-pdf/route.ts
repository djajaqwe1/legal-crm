import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const { text, title } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Создаем PDF в памяти (Buffer)
    const chunks: Buffer[] = [];
    const doc = new PDFDocument();

    doc.on("data", (chunk) => chunks.push(chunk));

    // Приоритет шрифтов: bundled DejaVuSans (кириллица), системные шрифты, дефолт
    const fontCandidates = [
      path.join(process.cwd(), "public", "fonts", "DejaVuSans.ttf"),
      "C:\\Windows\\Fonts\\arial.ttf",
      "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/System/Library/Fonts/Helvetica.ttc",
    ];
    for (const fp of fontCandidates) {
      if (fs.existsSync(fp)) {
        doc.font(fp);
        break;
      }
    }

    doc.fontSize(16).text(title || "Документ", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(text, {
      align: "left",
      lineGap: 2,
    });

    doc.end();

    return new Promise<NextResponse>((resolve) => {
      doc.on("end", () => {
        const result = Buffer.concat(chunks);
        resolve(
          new NextResponse(result, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${encodeURIComponent(title || "document")}.pdf"`,
            },
          }),
        );
      });
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "PDF generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
