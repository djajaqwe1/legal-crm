/** Документ можно скачать по прямой ссылке (локальные uploads). */
export function isDownloadableDocument(path: string): boolean {
  return path.startsWith("/uploads/");
}

/** Подпись для документов без файла на диске. */
export function documentStorageHint(path: string): string | null {
  if (path.startsWith("#import")) return "Импорт через Джарвис";
  if (path === "#serverless-no-url") return "Метаданные в CRM";
  if (path.startsWith("#")) return "В системе";
  return null;
}
