import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, pipelineId } = await req.json();
    if (!name || !pipelineId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const count = await prisma.crmStage.count({ where: { pipelineId } });
    const stage = await prisma.crmStage.create({
      data: {
        name,
        pipelineId,
        order: count
      },
      include: { cards: true }
    });

    return NextResponse.json(stage);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, name, order } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const stage = await prisma.crmStage.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(order !== undefined && { order })
      }
    });

    return NextResponse.json(stage);
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

    await prisma.crmStage.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
