import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";

/** Adds a column at the end of the requests board: `{ name }`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("request.manage");
    if (denied) return denied;
    const name = String((await req.json()).name ?? "").trim();
    if (!name || name.length > 100) return NextResponse.json({ error: "Nome inválido (máx. 100 caracteres)." }, { status: 400 });

    const last = await prisma.crmRequestColumn.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const column = await prisma.crmRequestColumn.create({
      data: { name, order: (last?.order ?? -1) + 1 },
      select: { id: true, name: true },
    });
    return NextResponse.json(column);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a column (`?id=`); its requests move to the end of the first remaining column. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("request.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const error = await prisma.$transaction(async (tx) => {
      const target = await tx.crmRequestColumn.findFirst({ where: { NOT: { id } }, orderBy: { order: "asc" }, select: { id: true } });
      if (!target) return "Não é possível excluir a última coluna.";

      const offset = await tx.crmRequest.count({ where: { columnId: target.id } });
      const moving = await tx.crmRequest.findMany({ where: { columnId: id }, orderBy: { order: "asc" }, select: { id: true } });
      await Promise.all(
        moving.map((r, i) => tx.crmRequest.update({ where: { id: r.id }, data: { columnId: target.id, order: offset + i } }))
      );
      const { count } = await tx.crmRequestColumn.deleteMany({ where: { id } });
      return count ? null : "Coluna não encontrada.";
    });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
