import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { GEMINI_MODELS, formatGeminiUserError } from "@/lib/gemini-models";
import { CaseKind, CaseStatus, ClientCategory } from "@/lib/generated-client";
import { ruToCaseStatus } from "@/lib/case-status";
import { appendJarvisMessages } from "@/lib/jarvis/sessions";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["text/plain", "application/pdf"]);

async function extractText(file: File): Promise<string> {
  if (file.type === "text/plain") {
    return (await file.text()).slice(0, 50_000);
  }
  if (file.type === "application/pdf") {
    const buf = Buffer.from(await file.arrayBuffer());
    return `[PDF: ${file.name}, ${buf.length} bytes — текст будет извлечён AI при анализе]`;
  }
  return `[Файл: ${file.name}, тип ${file.type}]`;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY не настроен" }, { status: 503 });
  }

  const wid = await resolveWorkspaceId();
  if (!wid) return NextResponse.json({ error: "Workspace not configured" }, { status: 503 });

  try {
    const form = await req.formData();
    const sessionId = form.get("sessionId");
    const comment = String(form.get("comment") ?? "").trim();
    const clientCategory = String(form.get("clientCategory") ?? "LEGAL_ENTITY");
    const folderGroup = String(form.get("folderGroup") ?? "").trim() || null;

    if (typeof sessionId !== "string" || !sessionId) {
      return NextResponse.json({ error: "sessionId обязателен" }, { status: 400 });
    }

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) {
      return NextResponse.json({ error: "Прикрепите хотя бы один файл" }, { status: 400 });
    }

    const parts: string[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `Файл ${file.name} больше 10 МБ` }, { status: 413 });
      }
      if (!ALLOWED.has(file.type) && !file.name.endsWith(".txt")) {
        return NextResponse.json({ error: `Неподдерживаемый тип: ${file.name}. Пока: .txt и .pdf` }, { status: 415 });
      }
      parts.push(`--- ${file.name} ---\n${await extractText(file)}`);
    }

    const combined = parts.join("\n\n").slice(0, 80_000);
    const prompt = `Ты — юрист CRM Казахстана. По материалам дел извлеки JSON (только JSON, без markdown):
{
  "clientName": "ФИО или ТОО",
  "caseTitle": "краткое название дела",
  "kind": "CONSULTATION или COURT или PROJECT",
  "status": "Новый|В работе|Суд|Пауза|Завершено",
  "description": "краткое описание",
  "expectedAmount": число или null,
  "paidAmount": число или null,
  "outcome": "PENDING|WON_FULL|DISMISSED|... или null",
  "courtInstance": "FIRST|APPEAL|CASSATION|SUPREME или null",
  "assignedLawyer": "ФИО или null"
}

Материалы:
${combined}

${comment ? `Комментарий юриста: ${comment}` : ""}`;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    let raw = "";
    for (const model of GEMINI_MODELS) {
      try {
        const res = await genAI.getGenerativeModel({ model }).generateContent(prompt);
        raw = res.response.text();
        if (raw) break;
      } catch {
        continue;
      }
    }

    if (!raw) {
      return NextResponse.json({ error: "AI не смог проанализировать материалы" }, { status: 503 });
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Не удалось распознать структуру дела" }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      clientName?: string;
      caseTitle?: string;
      kind?: string;
      status?: string;
      description?: string;
      expectedAmount?: number | null;
      paidAmount?: number | null;
      outcome?: string | null;
      courtInstance?: string | null;
      assignedLawyer?: string | null;
    };

    const clientName = parsed.clientName?.trim() || "Клиент из материалов";
    let client = await prisma.client.findFirst({
      where: { workspaceId: wid, name: { equals: clientName, mode: "insensitive" } },
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          workspaceId: wid,
          name: clientName,
          manager: parsed.assignedLawyer?.trim() || "Рустем Айкимбаев",
          phone: "",
          email: `import-${Date.now()}@crm.local`,
          category: clientCategory === "INDIVIDUAL" ? ClientCategory.INDIVIDUAL : ClientCategory.LEGAL_ENTITY,
          folderGroup,
        },
      });
    }

    const count = await prisma.legalCase.count({ where: { workspaceId: wid } });
    const code = `LC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    const kind = Object.values(CaseKind).includes(parsed.kind as CaseKind)
      ? (parsed.kind as CaseKind)
      : CaseKind.COURT;

    const newCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        clientId: client.id,
        code,
        title: parsed.caseTitle?.trim() || `Дело ${clientName}`,
        kind,
        status: ruToCaseStatus[parsed.status ?? ""] ?? CaseStatus.CLOSED,
        description: (parsed.description ?? comment) || null,
        expectedAmount: parsed.expectedAmount ?? undefined,
        paidAmount: parsed.paidAmount ?? undefined,
        assignedLawyer: parsed.assignedLawyer ?? undefined,
      },
    });

    for (const file of files) {
      const text = await extractText(file);
      await prisma.caseDocument.create({
        data: {
          legalCaseId: newCase.id,
          name: file.name,
          path: `#import-${Date.now()}`,
          category: "evidence",
          mimeType: file.type,
          sizeBytes: file.size,
          extractedText: text,
          storageProvider: "crm",
        },
      });
    }

    const reply = `Зарегистрировано дело **${newCase.code}** — «${newCase.title}» для «${client.name}». Загружено файлов: ${files.length}. Откройте карточку для проверки и правок.`;

    await appendJarvisMessages(sessionId, [
      { role: "user", content: comment || `Импорт материалов: ${files.map(f => f.name).join(", ")}` },
      {
        role: "assistant",
        content: reply,
        metadata: { toolUsed: "register_case", caseId: newCase.id, code: newCase.code },
      },
    ]);

    return NextResponse.json({
      reply,
      case: { id: newCase.id, code: newCase.code, title: newCase.title },
      client: { id: client.id, name: client.name },
      actions: [{ type: "navigate", path: `/admin/cases/${newCase.id}` }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
