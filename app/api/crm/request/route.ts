import { NextResponse } from "next/server";
import { CrmRequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";
import { notifyRequestArea, requestColumns } from "@/lib/crm-requests";
import { isArea } from "@/lib/crm-areas";

const isType = (v: unknown): v is CrmRequestType => Object.values(CrmRequestType).includes(v as CrmRequestType);

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
    if (title.length > 200) return NextResponse.json({ error: "Título muito longo (máx. 200 caracteres)." }, { status: 400 });
    if (!isArea(body.area)) return NextResponse.json({ error: "Escolha a área do pedido." }, { status: 400 });

    const [first] = await requestColumns();
    const count = await prisma.crmRequest.count({ where: { columnId: first.id } });
    const request = await prisma.crmRequest.create({
      data: {
        authorId: memberId,
        area: body.area,
        title,
        description,
        type: isType(body.type) ? body.type : CrmRequestType.IMPROVEMENT,
        columnId: first.id,
        order: count,
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
      const exists = await tx.crmRequest.count({ where: { id } });
      const column = await tx.crmRequestColumn.count({ where: { id: columnId } });
      if (!exists || !column) return false;

      const ids = (
        await tx.crmRequest.findMany({ where: { columnId, NOT: { id } }, orderBy: { order: "asc" }, select: { id: true } })
      ).map((r) => r.id);
      ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
      await Promise.all(ids.map((rid, order) => tx.crmRequest.update({ where: { id: rid }, data: { columnId, order } })));
      return true;
    });
    if (!found) return NextResponse.json({ error: "Pedido ou coluna não encontrado." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
