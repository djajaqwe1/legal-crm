import { NextResponse } from "next/server";
import { ContractStatus } from "@/lib/generated-client";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

export async function POST(request: Request) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { number, counterparty, type, clientId, bin_iin } = await request.json();

    if (!number || !counterparty) {
      return NextResponse.json(
        { error: "number and counterparty are required" },
        { status: 400 },
      );
    }

    const contract = await prisma.contract.create({
      data: {
        workspaceId: wid,
        number,
        counterparty,
        type: type ?? "—",
        clientId: clientId || null,
        bin_iin,
        status: ContractStatus.DRAFT,
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
