import { prisma } from "@/lib/prisma";

export type CaseRow = {
  id: string;
  code: string;
  title: string;
  clientName: string | null;
};

export async function findCasesByQuery(
  workspaceId: string,
  query: string,
  limit = 5,
): Promise<CaseRow[]> {
  if (workspaceId === "offline-workspace") return [];
  const q = query.trim();
  if (!q) return [];

  const rows = await prisma.legalCase.findMany({
    where: {
      workspaceId,
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    include: { client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map(r => ({
    id: r.id,
    code: r.code,
    title: r.title,
    clientName: r.client?.name ?? null,
  }));
}

export type CaseResolveResult =
  | { type: "found"; case: CaseRow }
  | { type: "ambiguous"; cases: CaseRow[]; query: string }
  | { type: "not_found"; query: string };

const CASE_CODE_RE = /^LC-\d{4}-\d+$/i;

/** Код дела вида LC-2026-011 — не путать с Prisma id (cuid). */
export function isCaseCode(value: string): boolean {
  return CASE_CODE_RE.test(value.trim());
}

/** Gemini иногда кладёт код дела в caseId — приводим к реальному id. */
export async function normalizeCaseArgs(
  workspaceId: string,
  args: Record<string, unknown>,
): Promise<{ args: Record<string, unknown> } | { error: string }> {
  const next = { ...args };
  const rawId = typeof next.caseId === "string" ? next.caseId.trim() : "";
  if (!rawId) return { args: next };

  if (isCaseCode(rawId)) {
    const resolved = await resolveCaseQuery(workspaceId, rawId);
    if (resolved.type === "not_found") {
      return { error: `Дело «${rawId}» не найдено. Уточните код LC-2026-XXX.` };
    }
    if (resolved.type === "ambiguous") return { error: formatCaseDisambiguation(resolved.cases) };
    next.caseId = resolved.case.id;
    delete next.caseQuery;
    return { args: next };
  }

  return { args: next };
}

export async function resolveCaseQuery(
  workspaceId: string,
  query: string,
): Promise<CaseResolveResult> {
  const q = query.trim();
  if (!q) return { type: "not_found", query: q };
  if (workspaceId === "offline-workspace") {
    return { type: "not_found", query: q };
  }

  const exact = await prisma.legalCase.findFirst({
    where: { workspaceId, code: { equals: q, mode: "insensitive" } },
    include: { client: { select: { name: true } } },
  });
  if (exact) {
    return {
      type: "found",
      case: {
        id: exact.id,
        code: exact.code,
        title: exact.title,
        clientName: exact.client?.name ?? null,
      },
    };
  }

  const cases = await findCasesByQuery(workspaceId, q, 5);
  if (!cases.length) return { type: "not_found", query: q };
  if (cases.length === 1) return { type: "found", case: cases[0] };
  return { type: "ambiguous", cases, query: q };
}

export function formatCaseDisambiguation(cases: CaseRow[]): string {
  const list = cases
    .map((c, i) => `${i + 1}. ${c.code} — ${c.title}${c.clientName ? ` (${c.clientName})` : ""}`)
    .join("\n");
  return `Нашёл несколько дел. Уточните код или номер:\n${list}`;
}

/** Из pageContext CRM извлекаем подсказку для «текущего дела». */
export function extractCaseHintFromPageContext(pageContext?: string): string | null {
  if (!pageContext) return null;

  const code = pageContext.match(/\b(LC-\d{4}-\d{3,})\b/i)?.[1];
  if (code) return code;

  const id = pageContext.match(/caseId:([a-f0-9-]{36})/i)?.[1];
  if (id) return id;

  const titled = pageContext.match(/дело\s+[«"]?([^»".]+)[»"]?/i)?.[1]?.trim();
  if (titled && titled.length >= 3) return titled;

  const client = pageContext.match(/Клиент:\s*([^.«»]+)/i)?.[1]?.trim();
  if (client && client.length >= 3) return client;

  return null;
}
