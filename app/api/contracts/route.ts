import { NextResponse } from "next/server";
import { ContractStatus } from "@/lib/generated-client";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";

type ContractInput = {
  number: string;
  counterparty: string;
  type?: string;
  clientId?: string;
  bin_iin?: string;
};

export async function POST(request: Request) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const body = await request.json();

    // Support both single contract and array of contracts
    const items: ContractInput[] = Array.isArray(body) ? body : [body];

    if (items.length === 0) {
      return NextResponse.json({ error: "No contracts provided" }, { status: 400 });
    }

    for (const item of items) {
      if (!item.number || !item.counterparty) {
        return NextResponse.json(
          { error: "number and counterparty are required for each contract" },
          { status: 400 },
        );
      }
    }

    if (items.length === 1) {
      const { number, counterparty, type, clientId, bin_iin } = items[0];
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
    }

    // Bulk creation
    const created = await prisma.$transaction(
      items.map(({ number, counterparty, type, clientId, bin_iin }) =>
        prisma.contract.create({
          data: {
            workspaceId: wid,
            number,
            counterparty,
            type: type ?? "—",
            clientId: clientId || null,
            bin_iin,
            status: ContractStatus.DRAFT,
          },
        }),
      ),
    );

    return NextResponse.json({ created: created.length, contracts: created }, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
