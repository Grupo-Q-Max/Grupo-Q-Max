import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const team = await prisma.teamMember.findMany({
      orderBy: { order: "asc" },
    });
    
    const mappedTeam = team.map((member: any) => ({
      id: member.id,
      name: member.name,
      role: member.role,
      sector: "Liderança",
      image: member.photo,
      order: member.order,
      bio: member.bio,
    }));

    return NextResponse.json(mappedTeam, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json([], { status: 500 });
  }
}

