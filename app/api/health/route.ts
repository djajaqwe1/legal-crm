import { NextResponse } from "next/server";
import { isDatabaseReachable } from "@/lib/db-health";
import { isSupabaseStorageConfigured } from "@/lib/storage/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await isDatabaseReachable();
  const storage = isSupabaseStorageConfigured();
  return NextResponse.json(
    {
      ok: true,
      db,
      storage,
      storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "legal-documents",
      storagePublic: process.env.SUPABASE_STORAGE_PUBLIC === "true",
    },
    { status: 200 },
  );
}
