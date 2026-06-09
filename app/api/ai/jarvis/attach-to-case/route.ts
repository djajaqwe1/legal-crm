import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { isDatabaseReachable } from "@/lib/db-health";
import { resolveCaseQuery } from "@/lib/jarvis/case-resolve";
import { appendJarvisMessages } from "@/lib/jarvis/sessions";
import { addDocument } from "@/lib/crm-repository";
import { extractDocumentText, extractionSummary } from "@/lib/document-extract";
import { storeCaseFile } from "@/lib/storage/document-storage";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function POST(req: Request) {
  if (!(await isDatabaseReachable())) {
    return NextResponse.json(
      {
        error:
          "Демо без базы: прикрепление файлов к делам недоступно. Откройте https://project-072fj.vercel.app/admin или настройте DATABASE_URL.",
        offline: true,
      },
      { status: 503 },
    );
  }

  const wid = await resolveWorkspaceId();
  if (!wid) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });
  }

  try {
    const form = await req.formData();
    const sessionId = form.get("sessionId");
    const caseQuery = String(form.get("caseQuery") ?? "").trim();
    const caseIdRaw = String(form.get("caseId") ?? "").trim();
    const comment = String(form.get("comment") ?? "").trim();

    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "sessionId обязателен" }, { status: 400 });
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Прикрепите хотя бы один файл" }, { status: 400 });
    }

    let caseId = caseIdRaw;
    let caseCode = caseQuery;

    if (!caseId && caseQuery) {
      const resolved = await resolveCaseQuery(wid, caseQuery);
      if (resolved.type === "ambiguous") {
        return NextResponse.json({
          error: "Найдено несколько дел — укажите код LC-2026-XXX",
          cases: resolved.cases,
        }, { status: 409 });
      }
      if (resolved.type === "not_found") {
        return NextResponse.json({ error: `Дело «${caseQuery}» не найдено` }, { status: 404 });
      }
      caseId = resolved.case.id;
      caseCode = resolved.case.code;
    }

    if (!caseId) {
      return NextResponse.json({ error: "Укажите дело" }, { status: 400 });
    }

    const uploaded: string[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `Файл ${file.name} больше 10 МБ` }, { status: 413 });
      }
      if (!ALLOWED.has(file.type) && !file.name.match(/\.(pdf|txt|doc|docx|jpg|jpeg|png)$/i)) {
        return NextResponse.json({ error: `Неподдерживаемый тип: ${file.name}` }, { status: 415 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const text =
        (await extractDocumentText(buffer, file.type || "application/octet-stream", file.name)) ??
        extractionSummary(file.type, file.name, null);
      const stored = await storeCaseFile(caseId, file.name, buffer, file.type || "application/octet-stream");
      await addDocument(caseId, file.name, stored.path, {
        storageProvider: stored.storageProvider,
        externalUrl: stored.externalUrl,
        mimeType: stored.mimeType ?? file.type,
        sizeBytes: stored.sizeBytes ?? file.size,
        extractedText: text,
        category: "evidence",
      });
      uploaded.push(file.name);
    }

    const reply = `Прикрепил ${uploaded.length} файл(ов) к делу **${caseCode}**: ${uploaded.join(", ")}.${comment ? `\n\nКомментарий: ${comment}` : ""}`;

    await appendJarvisMessages(sessionId, [
      {
        role: "user",
        content: comment || `Документы в ${caseCode}: ${uploaded.join(", ")}`,
      },
      {
        role: "assistant",
        content: reply,
        metadata: { toolUsed: "attach_documents", caseId, caseCode },
      },
    ]);

    return NextResponse.json({
      reply,
      case: { id: caseId, code: caseCode },
      uploaded,
      actions: [{ type: "navigate", path: `/admin/cases/${caseId}` }, { type: "refresh" }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Attach failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
