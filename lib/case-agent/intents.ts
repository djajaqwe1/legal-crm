import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import type { CaseAssistantContext } from "@/lib/crm-repository";
import { executeCaseTool } from "./executor";

export function matchCaseTaskIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /задач|план|шаг|todo|внеси|поставь|создай|сам придумай|в систем|автомат|добавь.*дел|оператор/i.test(t);
}

type GeneratedTask = { title: string; dueDate?: string | null };

export async function autoGenerateCaseTasks(
  workspaceId: string,
  context: CaseAssistantContext,
  userMessage: string,
): Promise<{ reply: string; tasksCreated: number; taskTitles: string[] }> {
  const docTexts = context.documents
    .map(d => (d.extractedText ? `${d.name}: ${d.extractedText.slice(0, 3000)}` : d.name))
    .join("\n");

  const prompt = `Составь план работ юриста по делу. Верни ТОЛЬКО JSON без markdown:
{"tasks":[{"title":"...","dueDate":"YYYY-MM-DD или null"}]}

Дело: ${context.title}
Клиент: ${context.client}
Статус: ${context.status}
Документы и материалы:
${docTexts || "нет текста, опирайся на название дела"}

Запрос юриста: ${userMessage}

Нужно 5–8 конкретных задач на русском (подготовка документов, переговоры, претензия, расчёт, суд и т.д.).`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
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

  let tasks: GeneratedTask[] = [];

  if (raw) {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { tasks?: GeneratedTask[] };
        tasks = parsed.tasks?.filter(t => t.title?.trim()) ?? [];
      } catch {
        tasks = [];
      }
    }
  }

  if (!tasks.length) {
    tasks = buildFallbackTasks(context.title);
  }

  const result = await executeCaseTool(workspaceId, context.caseId, "add_tasks", { tasks });
  const titles = tasks.map(t => t.title.trim());

  const list = titles.map(t => `• ${t}`).join("\n");
  return {
    reply: result.success
      ? `Добавил ${result.tasksCreated ?? titles.length} задач в дело ${context.code}:\n\n${list}\n\nОбновите страницу — они появятся справа.`
      : result.message,
    tasksCreated: result.tasksCreated ?? 0,
    taskTitles: titles,
  };
}

function buildFallbackTasks(caseTitle: string): GeneratedTask[] {
  const t = caseTitle.toLowerCase();
  const base = [
    "Проанализировать материалы дела и составить хронологию",
    "Подготовить правовую позицию и риски",
    "Согласовать стратегию с клиентом",
    "Подготовить проект документа (претензия / заявление / соглашение)",
    "Направить документ контрагенту и зафиксировать отправку",
    "Контроль сроков ответа и эскалация при необходимости",
  ];
  if (/расторж|аренд/.test(t)) {
    base.unshift("Проверить условия расторжения и расчёт задолженности/неустойки");
  }
  return base.map(title => ({ title, dueDate: null }));
}
