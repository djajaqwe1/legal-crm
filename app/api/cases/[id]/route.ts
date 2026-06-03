import { NextResponse } from "next/server";
import { ruToCaseStatus } from "@/lib/case-status";
import { prisma } from "@/lib/prisma";
import {
  CaseKind,
  CaseOutcome,
  CourtInstance,
  type CaseStatus,
} from "@/lib/generated-client";
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
      kind?: string;
      parentCaseId?: string | null;
      outcome?: string | null;
      courtInstance?: string | null;
      assignedLawyer?: string | null;
    };

    const data: {
      status?: CaseStatus;
      objectId?: string | null;
      description?: string;
      kind?: CaseKind;
      parentCaseId?: string | null;
      outcome?: CaseOutcome | null;
      courtInstance?: CourtInstance | null;
      assignedLawyer?: string | null;
    } = {};

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

    if (body.kind !== undefined) {
      if (!Object.values(CaseKind).includes(body.kind as CaseKind)) {
        return NextResponse.json({ error: "Недопустимый тип дела" }, { status: 400 });
      }
      data.kind = body.kind as CaseKind;
    }

    if (body.parentCaseId !== undefined) {
      if (body.parentCaseId === null || body.parentCaseId === "") {
        data.parentCaseId = null;
      } else {
        const parent = await prisma.legalCase.findFirst({
          where: { id: body.parentCaseId, workspaceId: wid, clientId: existing.clientId },
        });
        if (!parent) {
          return NextResponse.json(
            { error: "Родительское дело не найдено или принадлежит другому клиенту" },
            { status: 400 },
          );
        }
        if (parent.id === id) {
          return NextResponse.json({ error: "Дело не может быть родителем самого себя" }, { status: 400 });
        }
        data.parentCaseId = body.parentCaseId;
      }
    }

    if (body.outcome !== undefined) {
      if (body.outcome === null || body.outcome === "") {
        data.outcome = null;
      } else if (Object.values(CaseOutcome).includes(body.outcome as CaseOutcome)) {
        data.outcome = body.outcome as CaseOutcome;
      } else {
        return NextResponse.json({ error: "Недопустимый исход дела" }, { status: 400 });
      }
    }

    if (body.courtInstance !== undefined) {
      if (body.courtInstance === null || body.courtInstance === "") {
        data.courtInstance = null;
      } else if (Object.values(CourtInstance).includes(body.courtInstance as CourtInstance)) {
        data.courtInstance = body.courtInstance as CourtInstance;
      } else {
        return NextResponse.json({ error: "Недопустимая инстанция" }, { status: 400 });
      }
    }

    if (body.assignedLawyer !== undefined) {
      data.assignedLawyer =
        typeof body.assignedLawyer === "string" && body.assignedLawyer.trim()
          ? body.assignedLawyer.trim()
          : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
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
