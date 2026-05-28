import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { normalizePortalEmail, isValidPortalEmail } from "@/lib/portal-email";

export async function GET() {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json([]);
    }
    const clients = await prisma.client.findMany({
      where: { workspaceId: wid },
      omit: { portalPasswordHash: true },
      include: { _count: { select: { cases: true, objects: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(clients);
  } catch {
    return NextResponse.json(
      { error: "Database unavailable. Configure PostgreSQL first." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const body = (await request.json()) as {
      name?: string;
      manager?: string;
      phone?: string;
      email?: string;
    };
    if (!body.name || !body.manager) {
      return NextResponse.json(
        { error: "name and manager are required" },
        { status: 400 },
      );
    }

    const rawEmail = typeof body.email === "string" ? body.email.trim() : "";
    const emailNorm = rawEmail ? normalizePortalEmail(rawEmail) : null;
    if (emailNorm && !isValidPortalEmail(emailNorm)) {
      return NextResponse.json({ error: "Invalid email." }, { status: 400 });
    }

    const created = await prisma.client.create({
      data: {
        workspaceId: wid,
        name: body.name.trim(),
        manager: body.manager.trim(),
        phone: body.phone?.trim() || null,
        email: emailNorm,
      },
      omit: { portalPasswordHash: true },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Клиент с таким e-mail уже есть в этом workspace." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create client. Check database connection." },
      { status: 500 },
    );
  }
}
