import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";

/** Max of Decimal(10, 2) */
const MAX_PRICE = 99_999_999.99;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Validated { name?, price?, hasBonus? } from the body; a string is the error message. */
function parse(body: { name?: unknown; price?: unknown; hasBonus?: unknown }, required: boolean) {
  const data: { name?: string; price?: number; hasBonus?: boolean } = {};
  if (required || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return "Informe o nome do produto.";
    data.name = name;
  }
  if (required || body.price !== undefined) {
    const price = Number(body.price ?? 0);
    if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE) return "Preço inválido.";
    data.price = Math.round(price * 100) / 100;
  }
  if (body.hasBonus !== undefined) {
    if (typeof body.hasBonus !== "boolean") return "Bonificação inválida.";
    data.hasBonus = body.hasBonus;
  }
  return data;
}

const isDuplicate = (error: unknown) => (error as { code?: string }).code === "P2002";
const isMissing = (error: unknown) => (error as { code?: string }).code === "P2025";

/** Catalog products (/crm/products). Deal lines keep their own name/price snapshot. */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("product.manage");
    if (denied) return denied;
    const data = parse(await req.json(), true);
    if (typeof data === "string") return bad(data);
    const product = await prisma.crmProduct.create({ data: { name: data.name!, price: data.price!, hasBonus: data.hasBonus } });
    return NextResponse.json({ id: product.id });
  } catch (error) {
    if (isDuplicate(error)) return bad("Já existe um produto com esse nome.", 409);
    console.error(error);
    return bad("Internal Server Error", 500);
  }
}

export async function PUT(req: Request) {
  try {
    const denied = await denyUnless("product.manage");
    if (denied) return denied;
    const body = await req.json();
    if (typeof body.id !== "string") return bad("Missing id");
    const data = parse(body, false);
    if (typeof data === "string") return bad(data);
    await prisma.crmProduct.update({ where: { id: body.id }, data });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDuplicate(error)) return bad("Já existe um produto com esse nome.", 409);
    if (isMissing(error)) return bad("Produto não encontrado.", 404);
    console.error(error);
    return bad("Internal Server Error", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("product.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return bad("Missing id");
    // Deal lines keep their snapshot; their productId becomes null (onDelete: SetNull)
    await prisma.crmProduct.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isMissing(error)) return bad("Produto não encontrado.", 404);
    console.error(error);
    return bad("Internal Server Error", 500);
  }
}
