import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { denyUnless } from "@/lib/crm-access";
import { cardListInclude, serializeListCard } from "@/lib/crm-deal";

export async function POST(req: Request) {
  try {
    const denied = await denyUnless("pipeline.create");
    if (denied) return denied;
    const { name } = await req.json();
    
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const pipeline = await prisma.crmPipeline.create({
      data: {
        name,
        stages: {
          create: [
            { name: "Novos Leads", order: 0 },
            { name: "Em Contato", order: 1 },
            { name: "Fechado Ganho", order: 2 }
          ]
        }
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: { cards: { include: cardListInclude } }
        }
      }
    });

    return NextResponse.json(pipeline);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const pipeline = await prisma.crmPipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            cards: {
              orderBy: { order: "asc" },
              include: cardListInclude
            }
          }
        }
      }
    });

    if (!pipeline) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Serialize Decimal
    const serialized = {
      ...pipeline,
      stages: pipeline.stages.map(stage => ({
        ...stage,
        cards: stage.cards.map(serializeListCard)
      }))
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
