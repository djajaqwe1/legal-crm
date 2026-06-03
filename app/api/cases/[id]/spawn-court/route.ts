import { NextResponse } from "next/server";
import { CaseKind, CaseStatus } from "@/lib/generated-client";
import { prisma } from "@/lib/prisma";
import { applyCaseWorkflow, autoApplyCaseWorkflow } from "@/lib/case-workflows";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { title?: string };

    const parent = await prisma.legalCase.findFirst({
      where: { id, workspaceId: wid },
      include: { childCases: { where: { kind: CaseKind.COURT }, select: { id: true } } },
    });

    if (!parent) {
      return NextResponse.json({ error: "Дело не найдено" }, { status: 404 });
    }

    if (parent.kind !== CaseKind.CONSULTATION) {
      return NextResponse.json(
        { error: "Судебное дело можно создать только из консультации" },
        { status: 400 },
      );
    }

    const existingCourt = parent.childCases[0];
    if (existingCourt) {
      return NextResponse.json(
        {
          error: "Судебное дело уже создано",
          caseId: existingCourt.id,
        },
        { status: 409 },
      );
    }

    const count = await prisma.legalCase.count({ where: { workspaceId: wid } });
    const code = `LC-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;
    const title =
      body.title?.trim() ||
      (parent.title.startsWith("Суд:") ? parent.title : `Суд: ${parent.title}`);

    const courtCase = await prisma.legalCase.create({
      data: {
        workspaceId: wid,
        clientId: parent.clientId,
        objectId: parent.objectId,
        parentCaseId: parent.id,
        code,
        title,
        kind: CaseKind.COURT,
        status: CaseStatus.NEW,
        description: parent.description,
        assignedLawyer: parent.assignedLawyer,
        expectedAmount: parent.expectedAmount,
      },
    });

    await applyCaseWorkflow(courtCase.id, "consultation_to_court", { workspaceId: wid });
    await autoApplyCaseWorkflow(courtCase.id, CaseKind.COURT, null, wid);

    return NextResponse.json(
      {
        case: courtCase,
        navigate: `/admin/cases/${courtCase.id}`,
        tasksAdded: true,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Не удалось создать судебное дело" }, { status: 500 });
  }
}
