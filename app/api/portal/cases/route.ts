import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalApiContext } from "@/lib/portal-api-context";
import { caseStatusToRu } from "@/lib/case-status";

export async function GET() {
  const ctx = await getPortalApiContext();
  if (!ctx.ok) return ctx.response;

  const rows = await prisma.legalCase.findMany({
    where: { workspaceId: ctx.workspaceId, clientId: ctx.clientId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      deadline: true,
      updatedAt: true,
      object: { select: { name: true } },
    },
  });

  return NextResponse.json({
    cases: rows.map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      status: caseStatusToRu[r.status],
      deadline: r.deadline ? r.deadline.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
      objectLabel: r.object?.name ?? null,
    })),
  });
}
