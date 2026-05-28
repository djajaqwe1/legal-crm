import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalApiContext } from "@/lib/portal-api-context";
import { caseStatusToRu } from "@/lib/case-status";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;
  const { id } = await params;

  const row = await prisma.legalCase.findFirst({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      clientId: ctx.clientId,
    },
    include: {
      object: { select: { name: true } },
      tasks: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Дело не найдено." }, { status: 404 });
  }

  return NextResponse.json({
    case: {
      id: row.id,
      code: row.code,
      title: row.title,
      status: caseStatusToRu[row.status],
      deadline: row.deadline ? row.deadline.toISOString() : null,
      description: row.description,
      objectLabel: row.object?.name ?? null,
      tasks: row.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      })),
    },
  });
}
