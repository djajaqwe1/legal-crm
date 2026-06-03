const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "legal-documents";

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function storageBase(): string {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("SUPABASE_URL не настроен");
  return base;
}

function supabaseAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    Authorization: `Bearer ${serviceKey}`,
    apikey: serviceKey,
    ...extra,
  };
}

/** Загружает файл в Supabase Storage, возвращает публичный или подписанный URL. */
export async function uploadToSupabaseStorage(
  objectKey: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const key = objectKey.replace(/^\/+/, "");
  const encodedPath = key.split("/").map(encodeURIComponent).join("/");
  const uploadUrl = `${storageBase()}/storage/v1/object/${BUCKET}/${encodedPath}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: supabaseAuthHeaders({
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    }),
    body: new Uint8Array(buffer),
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Supabase Storage: ${uploadRes.status} ${err.slice(0, 200)}`);
  }

  if (process.env.SUPABASE_STORAGE_PUBLIC === "true") {
    const publicUrl = `${storageBase()}/storage/v1/object/public/${BUCKET}/${key}`;
    return { url: publicUrl, key };
  }

  const signUrl = `${storageBase()}/storage/v1/object/sign/${BUCKET}/${key}`;
  const signRes = await fetch(signUrl, {
    method: "POST",
    headers: supabaseAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 365 }),
  });

  if (!signRes.ok) {
    throw new Error("Не удалось создать ссылку на файл");
  }

  const signed = await signRes.json() as { signedURL?: string };
  const path = signed.signedURL?.startsWith("http")
    ? signed.signedURL
    : `${storageBase()}${signed.signedURL ?? ""}`;

  return { url: path, key };
}

export function buildCaseStorageKey(caseId: string, fileName: string): string {
  const safeCase = caseId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = fileName.replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_");
  return `cases/${safeCase}/${Date.now()}_${safeName}`;
}
