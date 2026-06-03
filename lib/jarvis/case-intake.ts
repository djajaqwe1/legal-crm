/** Разбор голосовых/текстовых заявок «новое дело + документ». */

export type CaseIntakeParsed = {
  clientName: string;
  title: string;
  description: string;
  deadline?: string;
  documentType?: "претензия" | "иск" | "ходатайство";
  adiletQuery: string;
  workflowId?: "pretension_flow" | "court_first_instance" | "consultation_intake";
};

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function extractTitle(text: string, clientName: string): string {
  const cleaned = text
    .replace(/^(нов(ое|ый)\s+дел[оа]?[:\s—-]*)/i, "")
    .replace(new RegExp(`(?:для|клиент[а]?)\\s+${clientName}\\s*[—,-]?\\s*`, "i"), "")
    .replace(/,?\s*дедлайн[^,.]*\.?/i, "")
    .replace(/,?\s*(нужн|состав|подготов)[^.]*\.?/i, "")
    .trim();

  const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim() ?? cleaned;
  if (firstSentence.length >= 8) return firstSentence.slice(0, 120);

  return cleaned.slice(0, 120) || `Дело — ${clientName}`;
}

function buildAdiletQuery(text: string): string {
  const topics: string[] = [];
  if (/жилищ|квартир|управляющ|осо|ремонт/i.test(text)) topics.push("жилищные отношения");
  if (/претенз|досудеб/i.test(text)) topics.push("досудебная претензия");
  if (/труд|увольн/i.test(text)) topics.push("трудовой кодекс");
  if (/договор|неустойк/i.test(text)) topics.push("гражданский кодекс договор");
  if (/иск|суд/i.test(text)) topics.push("гражданский процессуальный кодекс");
  return topics.length ? topics.join(" ") : text.slice(0, 80);
}

/** Составная задача юриста — не отдавать в простой intent-shortcut. */
export function isOperationalRequest(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /нов(ое|ый)\s+дел|создай\s+дел|зарегистрируй\s+дел|открой\s+дел\s+для/.test(t) ||
    /нужн(а|о|ы)?\s+(претенз|иск|ходатай|договор|документ)|состав(ь|ить)|подготов(ь|ить)|сгенериру/.test(t) ||
    /дедлайн\s+через|через\s+\d+\s+(недел|день|дня|дней)/.test(t) ||
    /добав(ь|ить)\s+задач|обнов(и|ить)\s+дел|создай\s+клиент/.test(t)
  );
}

export function parseCaseIntakeRequest(text: string): CaseIntakeParsed | null {
  const raw = text.trim();
  if (!raw) return null;

  const isIntake =
    /нов(ое|ый)\s+дел|создай\s+дел|зарегистрируй\s+дел/i.test(raw) ||
    (/нужн(а|о|ы)?\s+(претенз|иск|ходатай)/i.test(raw) && /для\s+[а-яa-z]/i.test(raw));

  if (!isIntake) return null;

  const clientMatch =
    raw.match(/(?:для|клиент[а]?)\s+([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9\-]*)/i) ??
    raw.match(/дело\s+([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9\-]*)/i);

  const clientName = clientMatch?.[1]?.trim();
  if (!clientName) return null;

  let deadline: string | undefined;
  const weeksMatch = raw.match(/через\s+(\d+)\s+недел/i);
  const daysMatch = raw.match(/через\s+(\d+)\s+дн/i);
  if (weeksMatch) deadline = addDays(new Date(), Number(weeksMatch[1]) * 7);
  else if (daysMatch) deadline = addDays(new Date(), Number(daysMatch[1]));

  let documentType: CaseIntakeParsed["documentType"];
  if (/претенз/i.test(raw)) documentType = "претензия";
  else if (/иск/i.test(raw)) documentType = "иск";
  else if (/ходатай/i.test(raw)) documentType = "ходатайство";

  const workflowId = documentType === "претензия"
    ? "pretension_flow"
    : documentType === "иск"
      ? "court_first_instance"
      : "consultation_intake";

  return {
    clientName,
    title: extractTitle(raw, clientName),
    description: raw,
    deadline,
    documentType,
    adiletQuery: buildAdiletQuery(raw),
    workflowId,
  };
}

export function buildIntakeConfirmReply(
  intake: CaseIntakeParsed,
  adiletSummary: string,
  lawsFound: number,
): string {
  const deadlineRu = intake.deadline
    ? new Date(intake.deadline).toLocaleDateString("ru-RU")
    : "не указан";

  const steps = [
    `1. Создам дело «${intake.title}» для «${intake.clientName}» (дедлайн: ${deadlineRu})`,
    intake.workflowId ? "2. Применю типовой чеклист задач по делу" : null,
    intake.documentType ? `3. Подготовлю черновик: ${intake.documentType}` : null,
  ].filter(Boolean);

  return [
    lawsFound > 0
      ? `Проверил базу Әділет — найдено ${lawsFound} релевантных акт(ов).`
      : "В Әділет по теме мало совпадений — документ составлю по вашему описанию.",
    "",
    "План действий:",
    ...steps,
    "",
    adiletSummary ? `Нормы:\n${adiletSummary.slice(0, 400)}${adiletSummary.length > 400 ? "…" : ""}` : "",
    "",
    "Разрешаете выполнить всё это?",
  ]
    .filter(Boolean)
    .join("\n");
}
