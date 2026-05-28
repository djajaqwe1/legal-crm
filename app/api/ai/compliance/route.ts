import { NextResponse } from "next/server";
import { analyzeContractCompliance } from "@/lib/ai-service";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { contractId } = await req.json();

    if (!contractId) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 });
    }

    // 1. Получаем данные договора из БД
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { legalCase: true }
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // В реальности мы бы читали файл договора. 
    // Пока используем описание дела или заглушку.
    const contentToAnalyze = contract.legalCase?.description || 
      `Договор №${contract.number} с контрагентом ${contract.counterparty} на тему: ${contract.type}`;

    // 2. Запускаем ИИ-анализ
    const analysis = await analyzeContractCompliance(contentToAnalyze);

    return NextResponse.json({ 
      analysis: analysis.text,
      model: analysis.model 
    });

  } catch (error: unknown) {
    console.error("Compliance check error:", error);
    const msg = error instanceof Error ? error.message : "Ошибка анализа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
