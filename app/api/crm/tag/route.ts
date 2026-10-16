import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";

const COLOR = /^#[0-9a-f]{6}$/i;

/** Every tag (etiquetas are shared by all boards), by name. */
export async function GET() {
  const tags = await prisma.crmTag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } });
  return NextResponse.json(tags);
}

/** Creates a tag: `{ name, color }`. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 50) return NextResponse.json({ error: "Nome inválido (máx. 50 caracteres)." }, { status: 400 });
    const color = typeof body.color === "string" && COLOR.test(body.color) ? body.color : "#8b5cf6";

    const tag = await prisma.crmTag.create({ data: { name, color }, select: { id: true, name: true, color: true } });
    return NextResponse.json(tag);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Já existe uma etiqueta com esse nome." }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Deletes a tag (`?id=`) and removes it from every card. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("deal.edit");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    await prisma.crmTag.deleteMany({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
