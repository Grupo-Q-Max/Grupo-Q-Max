import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const card = await prisma.crmCard.findUnique({
      where: { id },
      include: {
        stage: true,
        activities: {
          orderBy: { createdAt: "desc" }
        },
        products: true
      }
    });

    if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...card,
      value: card.value.toNumber()
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
