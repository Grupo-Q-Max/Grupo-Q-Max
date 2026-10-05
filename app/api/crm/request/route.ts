import { NextResponse } from "next/server";
import { CrmRequestStatus, CrmRequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { sessionMemberId } from "@/lib/auth";

const isType = (v: unknown): v is CrmRequestType => Object.values(CrmRequestType).includes(v as CrmRequestType);
const isStatus = (v: unknown): v is CrmRequestStatus => Object.values(CrmRequestStatus).includes(v as CrmRequestStatus);

/** Any active CRM user sends a request: `{ type, title, description }`. */
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

    const request = await prisma.crmRequest.create({
      data: { authorId: memberId, title, description, type: isType(body.type) ? body.type : CrmRequestType.IMPROVEMENT },
      select: { id: true },
    });
    return NextResponse.json(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Changes the status of a request: `{ id, status }`. */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("request.manage");
    if (denied) return denied;
    const { id, status } = await req.json();
    if (typeof id !== "string" || !isStatus(status)) return NextResponse.json({ error: "Status inválido." }, { status: 400 });

    const { count } = await prisma.crmRequest.updateMany({ where: { id }, data: { status } });
    if (!count) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
