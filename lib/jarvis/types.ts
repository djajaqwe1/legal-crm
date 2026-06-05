export type JarvisAction =
  | { type: "navigate"; path: string; label?: string }
  | { type: "refresh" };

export type JarvisStep = {
  tool: string;
  message: string;
  success: boolean;
};

export type JarvisToolResult = {
  success: boolean;
  data?: unknown;
  message: string;
  actions?: JarvisAction[];
};

export type PendingAction = {
  toolName: string;
  args: Record<string, unknown>;
};

export const READ_ONLY_TOOLS = new Set([
  "get_stats",
  "get_cases",
  "get_clients",
  "get_contracts",
  "get_overdue_cases",
  "find_case",
  "get_analytics",
  "get_lawyer_daily",
  "get_open_tasks",
  "get_case_context",
  "list_case_tasks",
  "search_adilet",
  "navigate_to",
]);

/** Опасные операции — не реализованы и заблокированы на уровне executor */
export const FORBIDDEN_TOOLS = new Set([
  "delete_case",
  "delete_client",
  "delete_contract",
  "delete_task",
  "delete_document",
  "bulk_delete",
  "drop_database",
]);

export const MUTATING_TOOLS = new Set([
  "create_case",
  "create_client",
  "update_case",
  "create_contract",
  "add_task",
  "apply_case_checklist",
  "generate_document",
  "intake_new_case",
  "generate_for_case",
  "complete_task",
]);

export const TOOL_LABELS: Record<string, string> = {
  create_case: "Создать дело",
  create_client: "Создать клиента",
  update_case: "Обновить дело",
  create_contract: "Создать договор",
  add_task: "Добавить задачу",
  apply_case_checklist: "Применить чеклист",
  generate_document: "Сгенерировать документ",
  intake_new_case: "Полный intake: дело + чеклист + документ",
  generate_for_case: "Документ по существующему делу",
  complete_task: "Отметить задачу выполненной",
};

export const VOICE_CONFIRM_RE =
  /^(да|ага|ок|okay|yes|разрешаю|подтверждаю|подтверждаю действие|давай|выполняй|сделай|конечно|верно)\b/i;

export const VOICE_DENY_RE =
  /^(нет|не надо|отмена|отмени|стоп|cancel|не нужно|отклон|отклоняю|не делай)\b/i;

export function isVoiceConfirm(text: string): boolean {
  return VOICE_CONFIRM_RE.test(text.trim());
}

export function isVoiceDeny(text: string): boolean {
  return VOICE_DENY_RE.test(text.trim());
}
