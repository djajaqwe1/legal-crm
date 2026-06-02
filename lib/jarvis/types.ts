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
  "navigate_to",
  "generate_document",
]);

export const MUTATING_TOOLS = new Set([
  "create_case",
  "create_client",
  "update_case",
  "create_contract",
  "add_task",
]);

export const VOICE_CONFIRM_RE =
  /^(да|ага|ок|okay|yes|разрешаю|подтверждаю|подтверждаю действие|давай|выполняй|сделай|конечно|верно)\b/i;
