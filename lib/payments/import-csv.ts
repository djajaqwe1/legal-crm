import { prisma } from "@/lib/prisma";

export type PaymentImportRow = {
  amount: number;
  paidAt: Date;
  source: string;
  caseCode?: string;
  description?: string;
};

export type PaymentImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

/** Парсит CSV: amount;date;source;caseCode;description (разделитель , или ;) */
export function parsePaymentsCsv(text: string): { rows: PaymentImportRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const rows: PaymentImportRow[] = [];

  if (!lines.length) {
    return { rows, errors: ["Файл пуст"] };
  }

  const startIdx = lines[0].toLowerCase().includes("amount") || lines[0].toLowerCase().includes("сумма") ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.includes(";") ? line.split(";") : line.split(",");
    if (parts.length < 2) {
      errors.push(`Строка ${i + 1}: мало колонок`);
      continue;
    }

    const amount = Number(String(parts[0]).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Строка ${i + 1}: неверная сумма`);
      continue;
    }

    const dateRaw = parts[1]?.trim();
    const paidAt = dateRaw ? new Date(dateRaw) : new Date();
    if (Number.isNaN(paidAt.getTime())) {
      errors.push(`Строка ${i + 1}: неверная дата`);
      continue;
    }

    const source = (parts[2]?.trim() || "import").toLowerCase();
    const caseCode = parts[3]?.trim() || undefined;
    const description = parts.slice(4).join(",").trim() || undefined;

    rows.push({ amount, paidAt, source, caseCode, description });
  }

  return { rows, errors };
}

export async function importPayments(
  workspaceId: string,
  rows: PaymentImportRow[],
): Promise<PaymentImportResult> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      let legalCaseId: string | undefined;
      let clientId: string | undefined;

      if (row.caseCode) {
        const legalCase = await prisma.legalCase.findFirst({
          where: { workspaceId, code: { equals: row.caseCode, mode: "insensitive" } },
          select: { id: true, clientId: true },
        });
        if (!legalCase) {
          errors.push(`${row.caseCode}: дело не найдено`);
          skipped++;
          continue;
        }
        legalCaseId = legalCase.id;
        clientId = legalCase.clientId;
      }

      await prisma.paymentTransaction.create({
        data: {
          workspaceId,
          legalCaseId: legalCaseId ?? null,
          clientId: clientId ?? null,
          amount: row.amount,
          source: row.source,
          paidAt: row.paidAt,
          description: row.description,
        },
      });

      if (legalCaseId) {
        const current = await prisma.legalCase.findUnique({
          where: { id: legalCaseId },
          select: { paidAmount: true },
        });
        await prisma.legalCase.update({
          where: { id: legalCaseId },
          data: { paidAmount: (current?.paidAmount ?? 0) + row.amount },
        });
      }

      imported++;
    } catch (e) {
      skipped++;
      errors.push(e instanceof Error ? e.message : "Ошибка строки");
    }
  }

  return { imported, skipped, errors };
}

export async function getRecentPayments(workspaceId: string, limit = 15) {
  return prisma.paymentTransaction.findMany({
    where: { workspaceId },
    orderBy: { paidAt: "desc" },
    take: limit,
    include: {
      legalCase: { select: { id: true, code: true, title: true } },
      client: { select: { name: true } },
    },
  });
}
