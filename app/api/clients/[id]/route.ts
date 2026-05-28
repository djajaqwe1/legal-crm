import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/workspace-scope";
import { normalizePortalEmail, isValidPortalEmail } from "@/lib/portal-email";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const wid = await resolveWorkspaceId();
    if (!wid) {
      return NextResponse.json({ error: "Workspace not configured." }, { status: 503 });
    }

    const { id } = await params;
    const existing = await prisma.client.findFirst({
      where: { id, workspaceId: wid },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }

    const body = (await request.json()) as {
      name?: string;
      manager?: string;
      phone?: string | null;
      email?: string | null;
      resetPortalAccess?: boolean;
    };

    const data: {
      name?: string;
      manager?: string;
      phone?: string | null;
      email?: string | null;
      portalPasswordHash?: string | null;
    } = {};

    if (typeof body.name === "string") {
      const t = body.name.trim();
      if (!t) return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
      data.name = t;
    }
    if (typeof body.manager === "string") {
      const t = body.manager.trim();
      if (!t) return NextResponse.json({ error: "manager cannot be empty." }, { status: 400 });
      data.manager = t;
    }
    if (body.phone !== undefined) {
      data.phone =
        typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
    }
    if (body.email !== undefined) {
      if (body.email === null || (typeof body.email === "string" && !body.email.trim())) {
        data.email = null;
        data.portalPasswordHash = null;
      } else if (typeof body.email === "string") {
        const norm = normalizePortalEmail(body.email);
        if (!isValidPortalEmail(norm)) {
          return NextResponse.json({ error: "Invalid email." }, { status: 400 });
        }
        data.email = norm;
      }
    }

    if (body.resetPortalAccess === true) {
      data.portalPasswordHash = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const updated = await prisma.client.update({
      where: { id, workspaceId: wid },
      data,
      omit: { portalPasswordHash: true },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Клиент с таким e-mail уже есть в этом workspace." },
        { status: 409 },
      );
    }
    console.error("PATCH /api/clients/[id]:", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}
