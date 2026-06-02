/** Документ можно скачать по прямой ссылке. */
export function isDownloadableDocument(path: string): boolean {
  return path.startsWith("/uploads/") || path.startsWith("https://");
}

/** Подпись для документов без файла на диске. */
export function documentStorageHint(path: string): string | null {
  if (path.startsWith("#import")) return "Импорт через Джарвис";
  if (path.startsWith("https://") && path.includes("supabase")) return "Supabase Storage";
  if (path === "#serverless-no-url") return "Метаданные в CRM";
  if (path.startsWith("#")) return "В системе";
  return null;
}
