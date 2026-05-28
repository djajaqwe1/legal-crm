export type PortalClientAccess = "none" | "pending" | "active";

export function portalAccessFromClient(client: {
  email: string | null;
  portalPasswordHash: string | null;
}): PortalClientAccess {
  if (!client.email?.trim()) return "none";
  if (client.portalPasswordHash) return "active";
  return "pending";
}

export function portalAccessLabel(status: PortalClientAccess): string {
  switch (status) {
    case "none":
      return "ЛК: нет e-mail";
    case "pending":
      return "ЛК: ждёт первый вход";
    case "active":
      return "ЛК активен";
    default:
      return "—";
  }
}
