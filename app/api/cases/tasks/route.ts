import { NextResponse } from "next/server";
import { addTask } from "@/lib/crm-repository";

export async function POST(request: Request) {
  try {
    const { caseId, title, dueDate } = await request.json();

    if (!caseId || !title) {
      return NextResponse.json(
        { error: "caseId and title are required" },
        { status: 400 }
      );
    }

    const task = await addTask(caseId, title, dueDate);
    return NextResponse.json(task, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
