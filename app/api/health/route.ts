import { NextResponse } from "next/server";
import { isDatabaseReachable } from "@/lib/db-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await isDatabaseReachable();
  return NextResponse.json({ ok: true, db }, { status: 200 });
}
