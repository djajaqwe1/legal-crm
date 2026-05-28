import { NextResponse } from "next/server";
import { runTeamWorkflow } from "@/lib/agents/workflow";

export async function POST(request: Request) {
  try {
    const { content, context } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const report = await runTeamWorkflow(content, context);

    return NextResponse.json(report);
  } catch (error: unknown) {
    console.error("Team Analyze Error:", error);
    const msg = error instanceof Error ? error.message : "Failed to run team analysis";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
