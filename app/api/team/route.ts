import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTeamInput, toTeamDto } from "@/lib/team";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const team = await prisma.teamMember.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
    return NextResponse.json(team.map(toTeamDto), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error), stack: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const member = await prisma.teamMember.create({
    data: {
      name: "Novo Membro",
      role: "Cargo",
      sector: "Setor",
      ...parseTeamInput(body),
      order: await prisma.teamMember.count(),
    },
  });
  return NextResponse.json(toTeamDto(member), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Reorder: receives the full ordered array of ids
  const { order } = (await req.json()) as { order: string[] };
  if (!Array.isArray(order)) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  await prisma.$transaction(order.map((id, idx) => prisma.teamMember.update({ where: { id }, data: { order: idx } })));
  const team = await prisma.teamMember.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(team.map(toTeamDto));
}
