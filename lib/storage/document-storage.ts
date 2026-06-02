import { uploadToSupabaseStorage, buildCaseStorageKey, isSupabaseStorageConfigured } from "./supabase-storage";

const IS_SERVERLESS = Boolean(
  process.env.VERCEL ?? process.env.AWS_LAMBDA_FUNCTION_NAME ?? process.env.NETLIFY,
);

export type StoredFile = {
  path: string;
  storageProvider: string;
  externalUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export async function storeCaseFile(
  caseId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  if (isSupabaseStorageConfigured()) {
    const key = buildCaseStorageKey(caseId, fileName);
    const { url, key: storedKey } = await uploadToSupabaseStorage(key, buffer, mimeType);
    return {
      path: url,
      storageProvider: "supabase",
      externalUrl: storedKey,
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  if (!IS_SERVERLESS) {
    const { writeFile, mkdir } = await import("fs/promises");
    const pathMod = await import("path");
    const safeCase = caseId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const savedName = `${Date.now()}_${fileName.replace(/[^\w.\-()а-яА-ЯёЁ ]/gu, "_")}`;
    const uploadDir = pathMod.join(process.cwd(), "public", "uploads", "cases", safeCase);
    await mkdir(uploadDir, { recursive: true });
    const filePath = pathMod.join(uploadDir, savedName);
    await writeFile(filePath, buffer);
    return {
      path: `/uploads/cases/${safeCase}/${savedName}`,
      storageProvider: "local",
      mimeType,
      sizeBytes: buffer.length,
    };
  }

  return {
    path: "#serverless-no-url",
    storageProvider: "crm",
    mimeType,
    sizeBytes: buffer.length,
  };
}
