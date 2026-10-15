import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";

const validName = (value: unknown) => {
  const name = String(value ?? "").trim();
  return name && name.length <= 100 ? name : null;
};

const duplicate = () => NextResponse.json({ error: "Já existe um espaço com esse nome." }, { status: 409 });

/** Adds a space at the end of the sidebar: `{ name }`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("space.manage");
    if (denied) return denied;
    const name = validName((await req.json()).name);
    if (!name) return NextResponse.json({ error: "Nome inválido (máx. 100 caracteres)." }, { status: 400 });

    const last = await prisma.crmSpace.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const space = await prisma.crmSpace.create({ data: { name, order: (last?.order ?? -1) + 1 }, select: { id: true, name: true } });
    return NextResponse.json(space);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return duplicate();
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Renames a space: `{ id, name }`. */
export async function PATCH(req: Request) {
  try {
    const denied = await denyUnless("space.manage");
    if (denied) return denied;
    const body = await req.json();
    const name = validName(body.name);
    if (typeof body.id !== "string" || !name) return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });

    const space = await prisma.crmSpace.update({ where: { id: body.id }, data: { name }, select: { id: true, name: true } });
    return NextResponse.json(space);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return duplicate();
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Espaço não encontrado." }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a space (`?id=`); its pipelines move to "Geral" (FK SetNull), nothing else is lost. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("space.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.crmSpace.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
