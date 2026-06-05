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

/** «перенеси дедлайн дела иванова на 15 июня» / «через 2 недели» */
function matchUpdateDeadline(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:перенеси|поставь|измени|обнови)\s+дедлайн\s+(?:дела\s+)?(.+?)\s+(?:на|через)\s+(.+)/i,
  );
  if (!m) return null;
  const caseQuery = m[1].trim();
  const deadline = parseDeadlinePhrase(m[2]);
  if (!deadline) return null;
  const deadlineRu = new Date(deadline).toLocaleDateString("ru-RU");
  return {
    toolName: "update_case",
    args: { caseQuery, field: "deadline", value: deadline },
    confirmReply: `Перенесу дедлайн дела «${caseQuery}» на ${deadlineRu}. Разрешаете?`,
  };
}

/** «отметь задачу позвонить клиенту выполненной в деле иванова» */
function matchCompleteTask(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:отметь|закрой|выполни|заверш)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?\s+(?:в\s+)?(?:деле\s+)?(.+)/i,
  );
  if (!m) return null;
  return {
    toolName: "complete_task",
    args: { caseQuery: m[2].trim(), taskQuery: m[1].trim() },
    confirmReply: `Отмечу задачу «${m[1].trim()}» выполненной в деле «${m[2].trim()}». Разрешаете?`,
  };
}

/** «покажи задачи дела LC-2026-001» — мгновенно */
function matchListCaseTasks(text: string): VoiceCommand | null {
  const m = text.match(/(?:покажи|список|какие)\s+задач(?:и|у)\s+(?:в\s+)?(?:деле\s+)?(.+)/i);
  if (!m) return null;
  return {
    toolName: "list_case_tasks",
    args: { caseQuery: m[1].trim() },
    confirmReply: "",
    instant: true,
  };
}

/** «обнови статус дела иванова на суд» */
function matchUpdateStatus(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:обнови|поставь|переведи|измени)\s+статус\s+(?:дела\s+)?(.+?)\s+(?:на|в)\s+(.+)/i,
  );
  if (!m) return null;
  const caseQuery = m[1].trim();
  const status = mapStatus(m[2]);
  if (!status) return null;
  return {
    toolName: "update_case",
    args: { caseQuery, field: "status", value: status },
    confirmReply: `Обновлю статус дела «${caseQuery}» → «${status}». Разрешаете?`,
  };
}

/** «добавь задачу подготовить иск — дело LC-2026-001» или «в дело иванова задачу позвонить клиенту» */
function matchAddTask(text: string): VoiceCommand | null {
  const m1 = text.match(
    /(?:добавь|создай)\s+задач(?:у|и)\s+[«"]?(.+?)[»"]?\s*(?:—|-|:|в\s+дело|для\s+дела)\s+(.+)/i,
  );
  if (m1) {
    return {
      toolName: "add_task",
      args: { caseQuery: m1[2].trim(), title: m1[1].trim() },
      confirmReply: `Добавлю задачу «${m1[1].trim()}» в дело «${m1[2].trim()}». Разрешаете?`,
    };
  }
  const m2 = text.match(
    /(?:добавь|создай)\s+задач(?:у|и)\s+(?:в\s+)?(?:дело\s+)?(.+?)\s*[—:-]\s*(.+)/i,
  );
  if (m2) {
    return {
      toolName: "add_task",
      args: { caseQuery: m2[1].trim(), title: m2[2].trim() },
      confirmReply: `Добавлю задачу «${m2[2].trim()}» в дело «${m2[1].trim()}». Разрешаете?`,
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

/** «сгенерируй претензию для дела иванова» */
function matchGenerateForCase(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:сгенерируй|составь|подготовь)\s+(претензию|иск|ходатайство)\s+(?:для\s+)?(?:дела\s+)?(.+)/i,
  );
  if (!m) return null;
  const docRaw = m[1].toLowerCase().replace(/ю$/, "я").replace(/^иск$/, "иск");
  const documentType =
    docRaw.includes("претенз") ? "претензия"
    : docRaw.includes("ходат") ? "ходатайство"
    : "иск";
  const caseQuery = m[2].trim().replace(/\.$/, "");
  return {
    toolName: "generate_for_case",
    args: { caseQuery, documentType },
    confirmReply: `Подготовлю «${documentType}» по делу «${caseQuery}» и сохраню в карточку. Разрешаете?`,
  };
}

/** «примени чеклист претензии к делу иванова» */
function matchApplyChecklist(text: string): VoiceCommand | null {
  const m = text.match(
    /(?:примени|добавь)\s+чеклист\s+(претенз|суд|консультац|апелляц)[^\s]*\s+(?:к\s+)?(?:делу\s+)?(.+)/i,
  );
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const workflowId =
    kind.startsWith("претенз") ? "pretension_flow"
    : kind.startsWith("апелля") ? "court_appeal"
    : kind.startsWith("консуль") ? "consultation_intake"
    : "court_first_instance";
  return {
    toolName: "apply_case_checklist",
    args: { caseQuery: m[2].trim(), workflowId },
    confirmReply: `Применю чеклист к делу «${m[2].trim()}». Разрешаете?`,
  };
}

export function matchVoiceCommand(text: string): VoiceCommand | null {
  const raw = text.trim();
  if (!raw || raw.length < 8) return null;

  return (
    matchOpenCase(raw) ??
    matchListCaseTasks(raw) ??
    matchUpdateDeadline(raw) ??
    matchUpdateStatus(raw) ??
    matchCompleteTask(raw) ??
    matchAddTask(raw) ??
    matchGenerateForCase(raw) ??
    matchApplyChecklist(raw) ??
    null
  );
}

/** Подсказки для UI */
export const VOICE_COMMAND_EXAMPLES = [
  "Новое дело для Иванова — спор с УК, через 2 недели претензия",
  "Открой дело LC-2026-001",
  "Обнови статус дела Иванова на суд",
  "Добавь задачу позвонить клиенту — дело Иванова",
  "Отметь задачу подготовить претензию выполненной в деле Иванова",
  "Сгенерируй претензию для дела Иванова",
  "Перенеси дедлайн дела Иванова через 2 недели",
  "Мой рабочий день",
];
