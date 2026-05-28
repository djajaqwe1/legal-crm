import { cookies } from "next/headers";
import {
  PORTAL_SESSION_COOKIE,
  verifyPortalToken,
  type PortalSessionPayload,
} from "@/lib/portal-session";
import { resolvePortalWorkspaceId } from "@/lib/portal-workspace";

/** Валидная подпись и срок + совпадение с текущим portal-workspace. */
export async function readPortalPayload(): Promise<PortalSessionPayload | null> {
  const wid = await resolvePortalWorkspaceId();
  if (!wid) return null;
  try {
    const token = (await cookies()).get(PORTAL_SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = verifyPortalToken(token);
    if (!payload || payload.workspaceId !== wid) return null;
    return payload;
  } catch {
    return null;
  }
}
