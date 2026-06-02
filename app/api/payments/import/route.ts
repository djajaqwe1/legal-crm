import { NextResponse } from "next/server";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { importPayments, parsePaymentsCsv } from "@/lib/payments/import-csv";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const wid = await resolveWorkspaceId();
  if (!wid) {
    return NextResponse.json({ error: "Workspace не настроен" }, { status: 503 });
  }

  try {
    const body = await req.json() as { csv?: string };
    if (!body.csv?.trim()) {
      return NextResponse.json({ error: "Передайте CSV-текст" }, { status: 400 });
    }

    const { rows, errors: parseErrors } = parsePaymentsCsv(body.csv);
    if (!rows.length) {
      return NextResponse.json(
        { error: parseErrors[0] ?? "Нет валидных строк" },
        { status: 400 },
      );
    }

    const result = await importPayments(wid, rows);
    return NextResponse.json({
      ...result,
      errors: [...parseErrors, ...result.errors],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
