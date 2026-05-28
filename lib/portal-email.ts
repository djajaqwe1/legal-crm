export function normalizePortalEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidPortalEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
