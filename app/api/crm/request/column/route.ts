import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { notifyRequestsChanged } from "@/lib/crm-realtime";

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
    notifyRequestsChanged();
    return NextResponse.json(column);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Sets the done column: `{ id }`, or `{ id: null }` for none. Its requests start the archive
 * countdown now; those of the previous done column stop it.
 */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("request.manage");
    if (denied) return denied;
    const { id } = await req.json();
    if (id !== null && typeof id !== "string") return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const found = await prisma.$transaction(async (tx) => {
      if (id && !(await tx.crmRequestColumn.count({ where: { id } }))) return false;
      await tx.crmRequest.updateMany({ where: { column: { isDone: true }, NOT: { columnId: id ?? undefined } }, data: { completedAt: null } });
      await tx.crmRequestColumn.updateMany({ where: { isDone: true }, data: { isDone: false } });
      if (id) {
        await tx.crmRequestColumn.update({ where: { id }, data: { isDone: true } });
        await tx.crmRequest.updateMany({ where: { columnId: id, completedAt: null }, data: { completedAt: new Date() } });
      }
      return true;
    });
    if (!found) return NextResponse.json({ error: "Coluna não encontrada." }, { status: 404 });
    notifyRequestsChanged();
    return NextResponse.json({ success: true });
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
      const target = await tx.crmRequestColumn.findFirst({ where: { NOT: { id } }, orderBy: { order: "asc" }, select: { id: true, isDone: true } });
      if (!target) return "Não é possível excluir a última coluna.";

      const offset = await tx.crmRequest.count({ where: { columnId: target.id } });
      const moving = await tx.crmRequest.findMany({ where: { columnId: id }, orderBy: { order: "asc" }, select: { id: true } });
      await Promise.all(
        moving.map((r, i) => tx.crmRequest.update({ where: { id: r.id }, data: { columnId: target.id, order: offset + i, completedAt: target.isDone ? new Date() : null } }))
      );
      const { count } = await tx.crmRequestColumn.deleteMany({ where: { id } });
      return count ? null : "Coluna não encontrada.";
    });
    if (error) return NextResponse.json({ error }, { status: 400 });
    notifyRequestsChanged();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
