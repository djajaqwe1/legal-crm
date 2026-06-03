const MAX_TEXT_CHARS = 50_000;

/** Извлекает текст из загруженного файла для AI и поиска в CRM. */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<string | null> {
  const lower = fileName.toLowerCase();

  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return normalizeExtractedText(buffer.toString("utf-8"));
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  return null;
}

function normalizeExtractedText(raw: string): string | null {
  const cleaned = raw
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return null;
  return cleaned.slice(0, MAX_TEXT_CHARS);
}

async function extractPdfText(buffer: Buffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return normalizeExtractedText(text);
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return null;
  }
}

export function extractionSummary(
  mimeType: string,
  fileName: string,
  extracted: string | null,
): string {
  if (extracted && extracted.length > 80) {
    return extracted.slice(0, 80).replace(/\s+/g, " ") + "…";
  }
  if (extracted) return extracted;

  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
    return "[PDF: текст не извлечён — возможно скан без OCR]";
  }

  return `[Файл: ${fileName}]`;
}
