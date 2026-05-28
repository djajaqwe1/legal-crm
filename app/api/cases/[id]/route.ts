import { NextResponse } from "next/server";
import { ruToCaseStatus } from "@/lib/case-status";
import { prisma } from "@/lib/prisma";
import type { CaseStatus } from "@/lib/generated-client";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      objectId?: string | null;
      description?: string;
    };

    const data: { status?: CaseStatus; objectId?: string | null; description?: string } = {};

    const existing = await prisma.legalCase.findFirst({
      where: { id, workspaceId: wid },
    });
    if (!existing) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    if (body.status !== undefined) {
      if (!ruToCaseStatus[body.status]) {
        return NextResponse.json(
          { error: "Valid status is required when status is sent" },
          { status: 400 },
        );
      }
      data.status = ruToCaseStatus[body.status];
    }

    if (body.objectId !== undefined) {
      if (body.objectId === null || body.objectId === "") {
        data.objectId = null;
      } else {
        const obj = await prisma.legalObject.findFirst({
          where: { id: body.objectId, clientId: existing.clientId, workspaceId: wid },
        });
        if (!obj) {
          return NextResponse.json(
            { error: "Object not found or does not belong to this client" },
            { status: 400 },
          );
        }
        data.objectId = body.objectId;
      }
    }

    if (body.description !== undefined) {
      data.description = body.description;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide status, objectId and/or description" },
        { status: 400 },
      );
    }

    const updated = await prisma.legalCase.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update case." },
      { status: 500 },
    );
  }
}
