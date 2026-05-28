import { NextResponse } from "next/server";
import { addDocument } from "@/lib/crm-repository";

export async function POST(request: Request) {
  try {
    const { caseId, name, path } = await request.json();

    if (!caseId || !name || !path) {
      return NextResponse.json(
        { error: "caseId, name and path are required" },
        { status: 400 }
      );
    }

    const doc = await addDocument(caseId, name, path);
    return NextResponse.json(doc, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
