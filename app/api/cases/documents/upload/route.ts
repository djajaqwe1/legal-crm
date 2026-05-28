import { NextResponse } from "next/server";
import { addDocument } from "@/lib/crm-repository";

export const config = { api: { bodyParser: false } };

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

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// На Vercel (и других serverless-платформах) нет постоянного доступа к файловой системе.
// В этом случае сохраняем документ в БД как ссылку без фактического файла.
const IS_SERVERLESS = Boolean(
  process.env.VERCEL ?? process.env.AWS_LAMBDA_FUNCTION_NAME ?? process.env.NETLIFY,
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const caseId = formData.get("caseId");
    const file = formData.get("file");

    if (typeof caseId !== "string" || !caseId.trim()) {
      return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Файл слишком большой. Максимум 10 МБ." },
        { status: 413 },
      );
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Неподдерживаемый тип файла. Разрешены: PDF, Word, Excel, JPG, PNG, TXT." },
        { status: 415 },
      );
    }

    // На serverless-платформах (Vercel) используем временное хранилище в /tmp
    // Файл регистрируется в БД, но физически не доступен по URL после перезапуска.
    if (IS_SERVERLESS) {
      const doc = await addDocument(caseId, file.name, "#serverless-no-url");
      return NextResponse.json(
        {
          ...doc,
          warning:
            "Файл зарегистрирован в базе данных, но физическое хранение недоступно в облачном режиме. Для полной поддержки загрузок добавьте Supabase Storage.",
        },
        { status: 201 },
      );
    }

    // Локальный режим — сохраняем файл в public/uploads
    const { writeFile, mkdir } = await import("fs/promises");
    const path = await import("path");

    const safeCase = caseId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const timestamp = Date.now();
    const originalName = file.name.replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_");
    const savedName = `${timestamp}_${originalName}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "cases", safeCase);
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, savedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const publicPath = `/uploads/cases/${safeCase}/${savedName}`;
    const doc = await addDocument(caseId, file.name, publicPath);
    return NextResponse.json(doc, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
