/**
 * Быстрые голосовые команды юриста — без Gemini, с подтверждением для изменений CRM.
 */

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
    matchUpdateStatus(raw) ??
    matchAddTask(raw) ??
    matchGenerateForCase(raw) ??
    matchApplyChecklist(raw) ??
    null
  );
}
