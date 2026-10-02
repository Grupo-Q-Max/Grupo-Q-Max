import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyStageChanged } from "@/lib/crm-realtime";

export async function POST(req: Request) {
  try {
    const { title, company, value, stageId, customData } = await req.json();
    if (!title || !stageId) return NextResponse.json({ error: "Missing title or stageId" }, { status: 400 });

    const card = await prisma.crmCard.create({
      data: {
        title,
        company: company || "",
        value: value || 0,
        stageId,
        customData: customData || {},
        order: await prisma.crmCard.count({ where: { stageId } })
      }
    });

    await notifyStageChanged(card.stageId);

    // We must return a serialized object for the client
    return NextResponse.json({
      ...card,
      value: card.value.toNumber()
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const card = await prisma.crmCard.delete({
      where: { id }
    });
    await notifyStageChanged(card.stageId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
