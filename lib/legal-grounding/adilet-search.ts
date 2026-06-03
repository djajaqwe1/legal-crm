import { searchAdilet, type AdiletDocument } from "@/lib/integrations/adilet";

export type LegalGroundingResult = {
  query: string;
  documents: AdiletDocument[];
  contextBlock: string;
  sources: Array<{ title: string; url: string }>;
};

/** Поиск в базе Әділет и форматирование контекста для LLM (anti-hallucination). */
export async function searchLegalGrounding(query: string, limit = 5): Promise<LegalGroundingResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: "", documents: [], contextBlock: "", sources: [] };
  }

  const documents = (await searchAdilet(trimmed)).slice(0, limit);
  const contextBlock = formatLegalContext(documents);
  const sources = documents.map(d => ({ title: d.title, url: d.url }));

  return { query: trimmed, documents, contextBlock, sources };
}

export function formatLegalContext(documents: AdiletDocument[]): string {
  if (!documents.length) {
    return "По запросу в базе Әділет (adilet.zan.kz) ничего не найдено. Не выдумывай статьи — сообщи, что нужен уточняющий запрос или ручная проверка.";
  }

  const blocks = documents.map((doc, i) => {
    const parts = [
      `[${i + 1}] ${doc.title}`,
      `Тип: ${doc.type} · Дата: ${doc.date}`,
      `URL: ${doc.url}`,
    ];
    if (doc.snippet) parts.push(`Фрагмент: ${doc.snippet}`);
    if (doc.articleRef) parts.push(`Статья/пункт: ${doc.articleRef}`);
    return parts.join("\n");
  });

  return [
    "НАЙДЕННЫЕ НОРМЫ ИЗ БАЗЫ ӘДІЛЕТ (adilet.zan.kz):",
    "Цитируй ТОЛЬКО то, что указано ниже. Не придумывай номера статей и ссылки.",
    "",
    blocks.join("\n\n---\n\n"),
  ].join("\n");
}
