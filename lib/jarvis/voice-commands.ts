/**
 * Быстрые голосовые команды юриста — без Gemini, с подтверждением для изменений CRM.
 */

import { parseDeadlinePhrase } from "./date-parse";

export type VoiceCommand = {
  toolName: string;
  args: Record<string, unknown>;
  confirmReply: string;
  /** Только навигация / поиск — без подтверждения */
  instant?: boolean;
};

export type VoiceMatchOptions = {
  /** Текущее дело с экрана CRM — для команд без явного «дело X» */
  defaultCaseQuery?: string;
};

const STATUS_MAP: Record<string, string> = {
  новый: "Новый",
  работа: "В работе",
  "в работе": "В работе",
  суд: "Суд",
  пауза: "Пауза",
  заверш: "Завершено",
  закрыт: "Завершено",
};

function mapStatus(raw: string): string | null {
  const t = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (t.includes(key)) return val;
  }
  return null;
}

function withDefaultCase(args: Record<string, unknown>, defaultCaseQuery?: string): Record<string, unknown> {
  if (!args.caseQuery && defaultCaseQuery) {
    return { ...args, caseQuery: defaultCaseQuery };
  }
  return args;
}

/** «мой рабочий день» / «что горит» */
function matchMorningBrief(text: string): VoiceCommand | null {
  if (/рабоч(ий|его)\s+день|мой\s+день|что\s+горит|что\s+срочно|план\s+на\s+день/.test(text.toLowerCase())) {
    return {
      toolName: "morning_brief",
      args: {},
      confirmReply: "",
      instant: true,
    };
  }
  return null;
}

/** «что по делу иванова» / «кратко по LC-2026-001» / «кратко» на экране дела */
function matchCaseBrief(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  if (/^(кратко|сводка|статус)$/i.test(text.trim()) && opts?.defaultCaseQuery) {
    return {
      toolName: "case_brief",
      args: { caseQuery: opts.defaultCaseQuery },
      confirmReply: "",
      instant: true,
    };
  }
  const m = text.match(
    /(?:что|расскажи|кратко|сводка|статус)\s+(?:по\s+)?(?:делу\s+)?(.+)/i,
  );
  if (!m) return null;
  const q = m[1].trim().replace(/\.$/, "");
  if (/^(CRM|сегодня|мне|на\s+сегодня)/i.test(q)) return null;
  return {
    toolName: "case_brief",
    args: withDefaultCase({ caseQuery: q }, opts?.defaultCaseQuery),
    confirmReply: "",
    instant: true,
  };
}

/** «найди в адилет жилищный кодекс» */
function matchSearchAdilet(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:найди|поиск|что\s+говорит)\s+(?:в\s+)?(?:адилет|әділет|базе\s+закон)[а]?\s+(?:по\s+)?(.+)/i,
  );
  if (m) {
    return {
      toolName: "search_adilet",
      args: { query: m[1].trim(), limit: 6 },
      confirmReply: "",
      instant: true,
    };
  }
  if (/^(?:адилет|әділет)\s+(.+)/i.test(text)) {
    const q = text.replace(/^(?:адилет|әділет)\s+/i, "").trim();
    if (q.length >= 4) {
      return {
        toolName: "search_adilet",
        args: { query: q, limit: 6 },
        confirmReply: "",
        instant: true,
      };
    }
  }
  return null;
}

/** Подсказка UI — переключить режим загрузки (обрабатывается в клиенте) */
export function matchRegisterCaseVoice(text: string): boolean {
  return /зарегистрируй\s+дело\s+(?:из|по)\s+(?:файл|документ|материал)|импорт\s+дел|загрузи\s+материалы|зарегистрируй\s+по\s+документам/i.test(
    text.trim(),
  );
}

/** «найди клиента петров» */
function matchFindClient(text: string): VoiceCommand | null {
  const m = text.match(/(?:найди|покажи|ищи)\s+клиент[а]?\s+(.+)/i);
  if (!m) return null;
  return {
    toolName: "get_clients",
    args: { search: m[1].trim(), limit: 8 },
    confirmReply: "",
    instant: true,
  };
}

/** «создай клиента Петров, телефон +7...» */
function matchCreateClient(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:создай|добавь|зарегистрируй)\s+клиент[а]?\s+(.+)/i,
  );
  if (!m) return null;
  const tail = m[1].trim();
  const phoneMatch = tail.match(/(?:телефон|тел\.?|phone)\s*[:—]?\s*([+\d\s()-]{6,})/i);
  const name = tail
    .replace(/(?:,|\s)*(?:телефон|тел\.?|phone)\s*[:—]?\s*[+\d\s()-]{6,}.*/i, "")
    .trim();
  if (!name || name.length < 2) return null;
  return {
    toolName: "create_client",
    args: { name, phone: phoneMatch?.[1]?.trim() ?? "" },
    confirmReply: `Создам клиента «${name}»${phoneMatch ? ` (${phoneMatch[1].trim()})` : ""}. Разрешаете?`,
  };
}

/** «оформи договор №123 с ТОО Альфа» */
function matchCreateContract(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:создай|оформи|зарегистрируй)\s+договор\s+(?:№|номер\s+)?([^\s,]+)\s+(?:с|контрагент)\s+(.+)/i,
  );
  if (!m) return null;
  return {
    toolName: "create_contract",
    args: { number: m[1].trim(), counterparty: m[2].trim().replace(/\.$/, ""), type: "услуги" },
    confirmReply: `Создам договор №${m[1].trim()} с «${m[2].trim()}». Разрешаете?`,
  };
}

/** «перенеси дедлайн дела иванова на 15 июня» / «через 2 недели» */
function matchUpdateDeadline(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m = text.match(
    /(?:перенеси|поставь|измени|обнови)\s+дедлайн\s+(?:дела\s+)?(.+?)\s+(?:на|через)\s+(.+)/i,
  );
  if (!m) return null;
  const caseQuery = m[1].trim() || opts?.defaultCaseQuery;
  if (!caseQuery) return null;
  const deadline = parseDeadlinePhrase(m[2]);
  if (!deadline) return null;
  const deadlineRu = new Date(deadline).toLocaleDateString("ru-RU");
  return {
    toolName: "update_case",
    args: { caseQuery, field: "deadline", value: deadline },
    confirmReply: `Перенесу дедлайн дела «${caseQuery}» на ${deadlineRu}. Разрешаете?`,
  };
}

/** «отметь задачу … выполненной» — два порядка слов */
function matchCompleteTask(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m1 = text.match(
    /(?:отметь|закрой|выполни|заверш)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?\s+(?:в\s+)?(?:деле\s+)?(.+)/i,
  );
  if (m1) {
    return {
      toolName: "complete_task",
      args: { caseQuery: m1[2].trim(), taskQuery: m1[1].trim() },
      confirmReply: `Отмечу задачу «${m1[1].trim()}» выполненной в деле «${m1[2].trim()}». Разрешаете?`,
    };
  }
  const m2 = text.match(
    /(?:в\s+)?(?:деле\s+)?(.+?)\s+(?:отметь|закрой|выполни)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?$/i,
  );
  if (m2) {
    const caseQuery = m2[1].trim() || opts?.defaultCaseQuery;
    if (!caseQuery) return null;
    return {
      toolName: "complete_task",
      args: { caseQuery, taskQuery: m2[2].trim() },
      confirmReply: `Отмечу задачу «${m2[2].trim()}» выполненной в деле «${caseQuery}». Разрешаете?`,
    };
  }
  return null;
}

/** «покажи задачи дела LC-2026-001» — мгновенно */
function matchListCaseTasks(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m = text.match(/(?:покажи|список|какие)\s+задач(?:и|у)\s+(?:в\s+)?(?:деле\s+)?(.+)/i);
  if (m) {
    return {
      toolName: "list_case_tasks",
      args: { caseQuery: m[1].trim() },
      confirmReply: "",
      instant: true,
    };
  }
  if (/^(задачи|мои\s+задачи)\s*(?:по\s+делу)?$/i.test(text.trim()) && opts?.defaultCaseQuery) {
    return {
      toolName: "list_case_tasks",
      args: { caseQuery: opts.defaultCaseQuery },
      confirmReply: "",
      instant: true,
    };
  }
  return null;
}

/** «обнови статус дела иванова на суд» */
function matchUpdateStatus(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m = text.match(
    /(?:обнови|поставь|переведи|измени)\s+статус\s+(?:дела\s+)?(.+?)\s+(?:на|в)\s+(.+)/i,
  );
  if (!m) return null;
  const caseQuery = m[1].trim() || opts?.defaultCaseQuery;
  if (!caseQuery) return null;
  const status = mapStatus(m[2]);
  if (!status) return null;
  return {
    toolName: "update_case",
    args: { caseQuery, field: "status", value: status },
    confirmReply: `Обновлю статус дела «${caseQuery}» → «${status}». Разрешаете?`,
  };
}

function parseTaskDueDate(titlePart: string): { title: string; dueDate?: string } {
  const duePatterns = [
    /(.+?)\s+(?:до|к)\s+(.+)$/i,
    /(.+?)\s+через\s+(\d+\s+(?:недел|дн|день|дня|дней).*)$/i,
  ];
  for (const re of duePatterns) {
    const m = titlePart.match(re);
    if (m) {
      const due = parseDeadlinePhrase(m[2].startsWith("через") ? m[2] : `через ${m[2]}`) ?? parseDeadlinePhrase(m[2]);
      if (due) return { title: m[1].trim(), dueDate: due };
    }
  }
  return { title: titlePart.trim() };
}

/** «добавь задачу … — дело …» или только «добавь задачу позвонить» на экране дела */
function matchAddTask(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m1 = text.match(
    /(?:добавь|создай)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?\s*(?:—|-|:|в\s+дело|для\s+дела)\s+(.+)/i,
  );
  if (m1) {
    const parsed = parseTaskDueDate(m1[1].trim());
    const dueRu = parsed.dueDate ? new Date(parsed.dueDate).toLocaleDateString("ru-RU") : null;
    return {
      toolName: "add_task",
      args: { caseQuery: m1[2].trim(), title: parsed.title, dueDate: parsed.dueDate },
      confirmReply: `Добавлю задачу «${parsed.title}»${dueRu ? ` до ${dueRu}` : ""} в дело «${m1[2].trim()}». Разрешаете?`,
    };
  }
  const m2 = text.match(
    /(?:добавь|создай)\s+задач(?:у|и)\s+(?:в\s+)?(?:дело\s+)?(.+?)\s*[—:-]\s*(.+)/i,
  );
  if (m2) {
    const parsed = parseTaskDueDate(m2[2].trim());
    return {
      toolName: "add_task",
      args: { caseQuery: m2[1].trim(), title: parsed.title, dueDate: parsed.dueDate },
      confirmReply: `Добавлю задачу «${parsed.title}» в дело «${m2[1].trim()}». Разрешаете?`,
    };
  }
  const m3 = text.match(/(?:добавь|создай)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?$/i);
  if (m3 && opts?.defaultCaseQuery) {
    const parsed = parseTaskDueDate(m3[1].trim());
    const dueRu = parsed.dueDate ? new Date(parsed.dueDate).toLocaleDateString("ru-RU") : null;
    return {
      toolName: "add_task",
      args: { caseQuery: opts.defaultCaseQuery, title: parsed.title, dueDate: parsed.dueDate },
      confirmReply: `Добавлю задачу «${parsed.title}»${dueRu ? ` до ${dueRu}` : ""} в текущее дело. Разрешаете?`,
    };
  }
  return null;
}

/** «открой дело LC-2026-001» */
function matchOpenCase(text: string): VoiceCommand | null {
  const m = text.match(/(?:открой|покажи|перейди\s+к)\s+дело\s+(.+)/i);
  if (!m) return null;
  const query = m[1].trim();
  return {
    toolName: "open_case",
    args: { query },
    confirmReply: "",
    instant: true,
  };
}

/** «сгенерируй претензию для дела иванова» / «сгенерируй претензию» на экране дела */
function matchGenerateForCase(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m = text.match(
    /(?:сгенерируй|составь|подготовь)\s+(претензию|иск|ходатайство)(?:\s+(?:для\s+)?(?:дела\s+)?(.+))?$/i,
  );
  if (!m) return null;
  const docRaw = m[1].toLowerCase();
  const documentType =
    docRaw.includes("претенз") ? "претензия"
    : docRaw.includes("ходат") ? "ходатайство"
    : "иск";
  const caseQuery = (m[2]?.trim() || opts?.defaultCaseQuery)?.replace(/\.$/, "");
  if (!caseQuery) return null;
  return {
    toolName: "generate_for_case",
    args: { caseQuery, documentType },
    confirmReply: `Подготовлю «${documentType}» по делу «${caseQuery}» и сохраню в карточку. Разрешаете?`,
  };
}

/** «примени чеклист претензии к делу иванова» */
function matchApplyChecklist(text: string, opts?: VoiceMatchOptions): VoiceCommand | null {
  const m = text.match(
    /(?:примени|добавь)\s+чеклист\s+(претенз|суд|консультац|апелляц|проект)[^\s]*\s+(?:к\s+)?(?:делу\s+)?(.+)/i,
  );
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const workflowId =
    kind.startsWith("претенз") ? "pretension_flow"
    : kind.startsWith("апелля") ? "court_appeal"
    : kind.startsWith("консуль") ? "consultation_intake"
    : kind.startsWith("проект") ? "project_documents"
    : "court_first_instance";
  const caseQuery = m[2].trim() || opts?.defaultCaseQuery;
  if (!caseQuery) return null;
  return {
    toolName: "apply_case_checklist",
    args: { caseQuery, workflowId },
    confirmReply: `Применю чеклист к делу «${caseQuery}». Разрешаете?`,
  };
}

export function matchVoiceCommand(text: string, options?: VoiceMatchOptions): VoiceCommand | null {
  const raw = text.trim();
  if (!raw || raw.length < 4) return null;

  return (
    matchMorningBrief(raw) ??
    matchSearchAdilet(raw) ??
    matchOpenCase(raw) ??
    matchCaseBrief(raw, options) ??
    matchFindClient(raw) ??
    matchListCaseTasks(raw, options) ??
    matchUpdateDeadline(raw, options) ??
    matchUpdateStatus(raw, options) ??
    matchCompleteTask(raw, options) ??
    matchAddTask(raw, options) ??
    matchGenerateForCase(raw, options) ??
    matchApplyChecklist(raw, options) ??
    matchCreateClient(raw) ??
    matchCreateContract(raw) ??
    null
  );
}

/** Подсказки для UI */
export const VOICE_COMMAND_EXAMPLES = [
  "Новое дело для Иванова — спор с УК, через 2 недели претензия",
  "Мой рабочий день",
  "Что по делу Иванова",
  "Добавь задачу позвонить клиенту",
  "Сгенерируй претензию",
  "Создай клиента Петров, телефон +77001234567",
  "Отметь задачу подготовить претензию выполненной",
  "Перенеси дедлайн через 2 недели",
];
