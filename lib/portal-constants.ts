/** Общий чат ЛК (без привязки к делу). */
export const PORTAL_AI_CONTEXT = "portal_ai";

/** Чат по конкретному делу из ЛК. */
export const PORTAL_CASE_CONTEXT = "portal_case";

export function getPortalAiDailyLimit(): number {
  const n = Number(process.env.PORTAL_AI_DAILY_LIMIT);
  if (Number.isFinite(n) && n >= 1 && n <= 500) return Math.floor(n);
  return 24;
}
