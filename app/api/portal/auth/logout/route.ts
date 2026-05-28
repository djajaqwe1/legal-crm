import { NextResponse } from "next/server";
import { clearPortalSessionCookie } from "@/lib/portal-session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearPortalSessionCookie(res);
  return res;
}
