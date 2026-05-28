import { CaseStatus } from "@/lib/generated-client";
import { NextResponse } from "next/server";
import { ruToCaseStatus } from "@/lib/case-status";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

function toStatus(value?: string): CaseStatus {
  return value ? ruToCaseStatus[value] ?? CaseStatus.NEW : CaseStatus.NEW;
}

export async function GET() {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json([]);
    }
    const data = await prisma.legalCase.findMany({
      where: { workspaceId: wid },
      include: { client: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable. Configure PostgreSQL first." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const body = (await request.json()) as {
      code?: string;
      title?: string;
      status?: string;
      deadline?: string;
      clientId?: string;
      objectId?: string | null;
    };

    if (!body.code || !body.title || !body.clientId) {
      return NextResponse.json(
        { error: "code, title and clientId are required" },
        { status: 400 },
      );
    }

    const client = await prisma.client.findFirst({
      where: { id: body.clientId, workspaceId: wid },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found in workspace." }, { status: 400 });
    }

    let objectId: string | null = null;
    if (body.objectId) {
      const obj = await prisma.legalObject.findFirst({
        where: { id: body.objectId, clientId: body.clientId, workspaceId: wid },
      });
      if (!obj) {
        return NextResponse.json(
          { error: "objectId must belong to the selected client" },
          { status: 400 },
        );
      }
      objectId = obj.id;
    }

    const legalCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        code: body.code.trim(),
        title: body.title.trim(),
        clientId: body.clientId,
        status: toStatus(body.status),
        deadline: body.deadline ? new Date(body.deadline) : null,
        objectId,
      },
    });

    return NextResponse.json(legalCase, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create case. Check database connection." },
      { status: 500 },
    );
  }
}
