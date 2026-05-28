/**
 * Продуктовые зоны и роли — ориентир для маршрутов, proxy и будущей модели Tenant.
 * Полное описание: docs/PRODUCT_ARCHITECTURE_RU.md
 */

/** Зоны приложения (разные сессии и политики доступа). */
export const AppZone = {
  /** Лендинг, реклама, форма лида. */
  publicMarketing: "public_marketing",
  /** ЛК клиента: AI-консультант с лимитом, воронка на консультацию. */
  clientPortal: "client_portal",
  /** CRM юриста и сотрудников (текущая /admin). */
  lawyerWorkspace: "lawyer_workspace",
  /** Оператор платформы (биллинг, поддержка). */
  platformOperator: "platform_operator",
} as const;

export type AppZoneId = (typeof AppZone)[keyof typeof AppZone];

/** Роли внутри тенанта (юридическая фирма-покупатель продукта). */
export const TenantRole = {
  owner: "owner",
  lawyer: "lawyer",
  assistant: "assistant",
} as const;

export type TenantRoleId = (typeof TenantRole)[keyof typeof TenantRole];

/** Роль конечного пользователя портала (не сотрудник CRM). */
export const PortalRole = {
  client: "client",
} as const;
