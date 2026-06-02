import { prisma } from "@/lib/prisma";
import { CaseKind, CaseOutcome } from "@/lib/generated-client";
import { caseStatusToRu } from "@/lib/case-status";

export type WorkspaceAnalytics = {
  totals: {
    clients: number;
    cases: number;
    consultations: number;
    courtCases: number;
    documents: number;
    paymentsTotal: number;
    expectedTotal: number;
    paidOnCases: number;
  };
  byStatus: Record<string, number>;
  byOutcome: Record<string, number>;
  byKind: Record<string, number>;
  byLawyer: Array<{ lawyer: string; cases: number }>;
  recentPayments: Array<{ amount: number; source: string; paidAt: string; caseCode?: string }>;
};

const KIND_LABELS: Record<CaseKind, string> = {
  CONSULTATION: "Консультации",
  COURT: "Судебные",
  PROJECT: "Проекты документов",
};

const OUTCOME_LABELS: Record<CaseOutcome, string> = {
  PENDING: "В процессе",
  WON_FULL: "Иск удовлетворён полностью",
  WON_PARTIAL: "Иск удовлетворён частично",
  DISMISSED: "Отказ в иске",
  REJECTED: "Отказано",
  LEFT_WITHOUT_CONSIDERATION: "Оставлено без рассмотрения",
  TERMINATED: "Производство прекращено",
  SETTLED: "Мировое соглашение",
  IN_APPEAL: "Апелляция",
  IN_CASSATION: "Кассация",
  IN_SUPREME: "Верховный суд",
};

export function outcomeLabel(o: CaseOutcome | null): string {
  if (!o) return "Не указан";
  return OUTCOME_LABELS[o] ?? o;
}

export async function getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalytics> {
  const [clients, cases, docs, payments, casesDetailed] = await Promise.all([
    prisma.client.count({ where: { workspaceId } }),
    prisma.legalCase.count({ where: { workspaceId } }),
    prisma.caseDocument.count({ where: { legalCase: { workspaceId } } }),
    prisma.paymentTransaction.findMany({
      where: { workspaceId },
      orderBy: { paidAt: "desc" },
      take: 10,
      include: { legalCase: { select: { code: true } } },
    }),
    prisma.legalCase.findMany({
      where: { workspaceId },
      select: {
        status: true,
        kind: true,
        outcome: true,
        assignedLawyer: true,
        expectedAmount: true,
        paidAmount: true,
      },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const lawyerMap = new Map<string, number>();
  let consultations = 0;
  let courtCases = 0;
  let expectedTotal = 0;
  let paidOnCases = 0;

  for (const c of casesDetailed) {
    const statusLabel = caseStatusToRu[c.status] ?? c.status;
    byStatus[statusLabel] = (byStatus[statusLabel] ?? 0) + 1;
    if (c.outcome) {
      const label = outcomeLabel(c.outcome);
      byOutcome[label] = (byOutcome[label] ?? 0) + 1;
    }
    const kindLabel = KIND_LABELS[c.kind] ?? c.kind;
    byKind[kindLabel] = (byKind[kindLabel] ?? 0) + 1;
    if (c.kind === CaseKind.CONSULTATION) consultations++;
    if (c.kind === CaseKind.COURT) courtCases++;
    const lawyer = c.assignedLawyer?.trim() || "Не назначен";
    lawyerMap.set(lawyer, (lawyerMap.get(lawyer) ?? 0) + 1);
    expectedTotal += c.expectedAmount ?? 0;
    paidOnCases += c.paidAmount ?? 0;
  }

  const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);

  return {
    totals: {
      clients,
      cases,
      consultations,
      courtCases,
      documents: docs,
      paymentsTotal,
      expectedTotal,
      paidOnCases,
    },
    byStatus,
    byOutcome,
    byKind,
    byLawyer: [...lawyerMap.entries()].map(([lawyer, count]) => ({ lawyer, cases: count })),
    recentPayments: payments.map(p => ({
      amount: p.amount,
      source: p.source,
      paidAt: p.paidAt.toISOString(),
      caseCode: p.legalCase?.code,
    })),
  };
}
