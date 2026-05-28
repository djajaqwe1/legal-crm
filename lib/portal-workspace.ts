import { prisma } from "@/lib/prisma";
import { isDatabaseReachable } from "@/lib/db-health";
import { DEFAULT_WORKSPACE_SLUG } from "@/lib/workspace-scope";

/**
 * Workspace для публичного ЛК: только slug из env / дефолт, без cookie администратора CRM.
 */
export async function resolvePortalWorkspaceId(): Promise<string | null> {
  if (!(await isDatabaseReachable())) return null;
  try {
    const slug = process.env.DEFAULT_WORKSPACE_SLUG ?? DEFAULT_WORKSPACE_SLUG;
    const bySlug = await prisma.workspace.findUnique({ where: { slug } });
    if (bySlug) return bySlug.id;
    const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
    return first?.id ?? null;
  } catch {
    return null;
  }
}
