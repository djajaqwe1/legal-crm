import { NextResponse } from "next/server";
import { searchSudKz } from "@/lib/integrations/sudkz";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (body.action === "SYNC") {
      // Имитируем синхронизацию с БД
      console.log("Syncing case to database:", body.caseData);
      
      // Здесь был бы вызов к prisma.legalCase.create(...)
      
      return NextResponse.json({ 
        success: true, 
        message: "Дело успешно синхронизировано. Агент-Регистратор создал уведомление и дедлайны.",
        notification: {
          title: "Новое дело из Судебного кабинета",
          description: `Дело №${body.caseData.caseNumber} добавлено в CRM. Установлены дедлайны по ГПК РК.`,
          date: new Date().toISOString()
        }
      });
    }

    const results = await searchSudKz(body);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("SudKz API Error:", error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
