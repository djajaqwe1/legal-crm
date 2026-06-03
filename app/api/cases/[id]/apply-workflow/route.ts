import { NextResponse } from "next/server";
import { applyCaseWorkflow, type CaseWorkflowId } from "@/lib/case-workflows";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { workflowId?: string };

    if (!body.workflowId) {
      return NextResponse.json({ error: "Укажите workflowId" }, { status: 400 });
    }

    const result = await applyCaseWorkflow(id, body.workflowId as CaseWorkflowId, {
      workspaceId: wid,
    });

    return NextResponse.json({
      ...result,
      message:
        result.created > 0
          ? `Добавлено задач: ${result.created}`
          : result.skipped > 0
            ? "Все задачи чеклиста уже есть в деле"
            : "Чеклист пуст",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "CASE_NOT_FOUND") {
      return NextResponse.json({ error: "Дело не найдено" }, { status: 404 });
    }
    return NextResponse.json({ error: "Не удалось применить чеклист" }, { status: 500 });
  }
}
