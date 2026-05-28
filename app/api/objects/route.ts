import { NextResponse } from "next/server";
import { createLegalObject, getLegalObjectsForClient } from "@/lib/crm-repository";

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const objects = await getLegalObjectsForClient(clientId);
  return NextResponse.json(objects);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { clientId?: string; name?: string };

    if (!body.clientId || !body.name?.trim()) {
      return NextResponse.json(
        { error: "clientId and name are required" },
        { status: 400 },
      );
    }

    const created = await createLegalObject(body.clientId, body.name);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "DATABASE_UNAVAILABLE") {
      return NextResponse.json(
        { error: "База данных недоступна. Проверьте DATABASE_URL." },
        { status: 503 },
      );
    }
    if (e instanceof Error && e.message === "CLIENT_NOT_IN_WORKSPACE") {
      return NextResponse.json(
        { error: "Клиент не найден в текущем workspace." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create object." },
      { status: 500 },
    );
  }
}
