import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isDatabaseReachable } from "@/lib/db-health";

const COOKIE_WORKSPACE = "active_workspace_id";

/** Имя cookie активного workspace (httpOnly). */
export const ACTIVE_WORKSPACE_COOKIE = COOKIE_WORKSPACE;

/** Slug рабочего пространства по умолчанию (ТОО «Конгломерат Алтай» и т.п.). */
export const DEFAULT_WORKSPACE_SLUG = "conglomerate-altai";

/**
 * Активный workspace для запроса: cookie → env → slug → первый в БД.
 * При недоступной БД — null (репозиторий уходит в офлайн-моки).
 */
export async function resolveWorkspaceId(): Promise<string | null> {
  if (!(await isDatabaseReachable())) {
    return null;
  }
  try {
    const jar = await cookies();
    const fromCookie = jar.get(COOKIE_WORKSPACE)?.value;
    if (fromCookie) {
      const byId = await prisma.workspace.findUnique({ where: { id: fromCookie } });
      if (byId) return byId.id;
    }
    const slug = process.env.DEFAULT_WORKSPACE_SLUG ?? DEFAULT_WORKSPACE_SLUG;
    const bySlug = await prisma.workspace.findUnique({ where: { slug } });
    if (bySlug) return bySlug.id;
    const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    if (first) return first.id;

    const boot = await prisma.workspace.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: "ТОО «Конгломерат Алтай»",
        settings: { source: "auto-bootstrap" },
      },
    });
    return boot.id;
  } catch {
    return null;
  }
}
