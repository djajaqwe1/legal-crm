export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  NEGOTIATION: "На согласовании",
  SIGNED: "Подписан",
  EXPIRING: "Истекает",
  ARCHIVED: "Архив",
};

export function contractStatusLabel(status: string): string {
  return CONTRACT_STATUS_LABELS[status] ?? status;
}
