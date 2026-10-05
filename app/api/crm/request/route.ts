import { NextResponse } from "next/server";
import { CrmRequestType, type CrmArea } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentPermissions, denyUnless } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";
import { canEditRequest, notifyRequestArea, requestColumns } from "@/lib/crm-requests";
import { isArea } from "@/lib/crm-areas";

const isType = (v: unknown): v is CrmRequestType => Object.values(CrmRequestType).includes(v as CrmRequestType);

/** Validation error of a title, else null. */
const titleError = (title: string) =>
  !title ? "Informe o título." : title.length > 200 ? "Título muito longo (máx. 200 caracteres)." : null;

/**
 * Any active CRM user sends a request: `{ type, area, title, description }`. It lands in the first
 * column and the members of the area are notified.
 */
export async function POST(req: Request) {
  try {
    const memberId = sessionMemberId(req);
    const member = memberId && (await prisma.teamMember.findUnique({ where: { id: memberId }, select: { crmActive: true } }));
    if (!member || !member.crmActive) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (!title || !description) return NextResponse.json({ error: "Informe o título e a descrição." }, { status: 400 });
    const invalid = titleError(title);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    if (!isArea(body.area)) return NextResponse.json({ error: "Escolha a área do pedido." }, { status: 400 });

    const [first] = await requestColumns();
    const count = await prisma.crmRequest.count({ where: { columnId: first.id, archivedAt: null } });
    const request = await prisma.crmRequest.create({
      data: {
        authorId: memberId,
        area: body.area,
        title,
        description,
        type: isType(body.type) ? body.type : CrmRequestType.IMPROVEMENT,
        columnId: first.id,
        order: count,
        completedAt: first.isDone ? new Date() : null,
      },
      select: { id: true, title: true, area: true, authorId: true },
    });
    await notifyRequestArea(request).catch((error) => console.error("Request notification failed", error));
    return NextResponse.json({ id: request.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Moves a request on the board: `{ id, columnId, index }`; renumbers the target column. */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("request.manage");
    if (denied) return denied;
    const { id, columnId, index } = await req.json();
    if (typeof id !== "string" || typeof columnId !== "string" || typeof index !== "number") {
      return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
    }

    const found = await prisma.$transaction(async (tx) => {
      const request = await tx.crmRequest.findUnique({ where: { id }, select: { completedAt: true } });
      const column = await tx.crmRequestColumn.findUnique({ where: { id: columnId }, select: { isDone: true } });
      if (!request || !column) return false;

      const ids = (
        await tx.crmRequest.findMany({
          where: { columnId, archivedAt: null, NOT: { id } },
          orderBy: { order: "asc" },
          select: { id: true },
        })
      ).map((r) => r.id);
      ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
      await Promise.all(ids.map((rid, order) => tx.crmRequest.update({ where: { id: rid }, data: { columnId, order } })));
      // The archive countdown starts when the request enters the done column
      const completedAt = column.isDone ? (request.completedAt ?? new Date()) : null;
      await tx.crmRequest.update({ where: { id }, data: { completedAt } });
      return true;
    });
    if (!found) return NextResponse.json({ error: "Pedido ou coluna não encontrado." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** The request `id` when the current user may edit it, else an error response. */
async function editable(req: Request, id: unknown) {
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const memberId = sessionMemberId(req);
  const canManage = (await currentPermissions()).has("request.manage");
  const request = await prisma.crmRequest.findUnique({ where: { id }, select: { id: true, authorId: true, column: { select: { isDone: true } } } });
  if (!request) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (!canEditRequest(memberId, canManage, request.authorId)) {
    return NextResponse.json({ error: "Você não tem permissão para esta ação." }, { status: 403 });
  }
  return request;
}

/**
 * Edits a request (author or `request.manage`): `{ id, type?, area?, title?, description?, archived? }`.
 * Unarchiving restarts the archive countdown when the request is still in the done column.
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const request = await editable(req, body.id);
    if (request instanceof NextResponse) return request;

    const data: {
      type?: CrmRequestType;
      area?: CrmArea;
      title?: string;
      description?: string;
      archivedAt?: Date | null;
      completedAt?: Date | null;
    } = {};
    if (body.type !== undefined) {
      if (!isType(body.type)) return NextResponse.json({ error: "Tipo inválido." }, { status: 400 });
      data.type = body.type;
    }
    if (body.area !== undefined) {
      if (!isArea(body.area)) return NextResponse.json({ error: "Escolha a área do pedido." }, { status: 400 });
      data.area = body.area;
    }
    if (body.title !== undefined) {
      data.title = String(body.title).trim();
      const invalid = titleError(data.title);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    }
    if (body.description !== undefined) {
      data.description = String(body.description).trim();
      if (!data.description) return NextResponse.json({ error: "Informe a descrição." }, { status: 400 });
    }
    if (body.archived === true) data.archivedAt = new Date();
    if (body.archived === false) {
      data.archivedAt = null;
      data.completedAt = request.column.isDone ? new Date() : null;
    }

    await prisma.crmRequest.update({ where: { id: request.id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a request (`?id=`; author or `request.manage`). Its notifications go with it. */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    const request = await editable(req, id);
    if (request instanceof NextResponse) return request;
    await prisma.crmRequest.deleteMany({ where: { id: request.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
