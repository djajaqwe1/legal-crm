import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const PORTAL_SESSION_COOKIE = "portal_session";

const PORTAL_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type PortalSessionPayload = {
  v: 1;
  clientId: string;
  workspaceId: string;
  exp: number;
};

const DEV_PORTAL_SECRET = "dev-only-portal-session-secret-32+chars";

/** Для выдачи сессии: в production без секрета — ошибка конфигурации. */
export function getPortalSessionSecretForSigning(): string {
  const s = process.env.PORTAL_SESSION_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return DEV_PORTAL_SECRET;
  throw new Error("PORTAL_SESSION_SECRET must be set (min 32 chars) in production.");
}

/** Для проверки cookie: в production без секрета токены не принимаются. */
export function getPortalSessionSecretForVerification(): string {
  const s = process.env.PORTAL_SESSION_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return DEV_PORTAL_SECRET;
  return "";
}

export function signPortalSession(payload: Omit<PortalSessionPayload, "v" | "exp"> & { exp?: number }): string {
  const full: PortalSessionPayload = {
    v: 1,
    clientId: payload.clientId,
    workspaceId: payload.workspaceId,
    exp: payload.exp ?? Date.now() + PORTAL_SESSION_MAX_AGE * 1000,
  };
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url");
  const secret = getPortalSessionSecretForSigning();
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPortalToken(token: string): PortalSessionPayload | null {
  try {
    const secret = getPortalSessionSecretForVerification();
    if (!secret) return null;
    const last = token.lastIndexOf(".");
    if (last <= 0) return null;
    const body = token.slice(0, last);
    const sig = token.slice(last + 1);
    const expected = createHmac("sha256", secret).update(body).digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PortalSessionPayload;
    if (parsed.v !== 1 || !parsed.clientId || !parsed.workspaceId || typeof parsed.exp !== "number") {
      return null;
    }
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function applyPortalSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE,
  });
}

export function clearPortalSessionCookie(res: NextResponse) {
  res.cookies.set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
