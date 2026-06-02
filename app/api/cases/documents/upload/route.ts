import { NextResponse } from "next/server";
import { addDocument } from "@/lib/crm-repository";
import { storeCaseFile } from "@/lib/storage/document-storage";
import { isSupabaseStorageConfigured } from "@/lib/storage/supabase-storage";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const caseId = formData.get("caseId");
    const file = formData.get("file");

    if (typeof caseId !== "string" || !caseId.trim()) {
      return NextResponse.json({ error: "Укажите дело" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Файл слишком большой. Максимум 10 МБ." }, { status: 413 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип. Разрешены: PDF, Word, Excel, JPG, PNG, TXT." },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeCaseFile(caseId, file.name, buffer, file.type);

    let extractedText: string | null = null;
    if (file.type === "text/plain") {
      extractedText = buffer.toString("utf-8").slice(0, 50_000);
    }

    const doc = await addDocument(caseId, file.name, stored.path, {
      storageProvider: stored.storageProvider,
      externalUrl: stored.externalUrl,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      extractedText,
      category: "evidence",
    });

    const warning = stored.path === "#serverless-no-url" && !isSupabaseStorageConfigured()
      ? "Файл сохранён в CRM. Для скачивания настройте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY."
      : undefined;

    return NextResponse.json({ ...doc, warning }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
