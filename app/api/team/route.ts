import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailTakenResponse, parseTeamInput, teamInclude, toPublicTeamDto, toTeamDto } from "@/lib/team";
import { adminGroupChange } from "@/lib/crm-access";
import { ADMIN_COOKIE, sessionMemberId } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Whole team for the admin and CRM users; the public site only gets members shown on it, without login data. */
export async function GET(req: NextRequest) {
  const internal = Boolean(sessionMemberId(req)) || isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
  try {
    const team = await prisma.teamMember.findMany({
      where: internal ? undefined : { showOnSite: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: teamInclude,
    });
    return NextResponse.json(team.map((m) => (internal ? toTeamDto(m) : toPublicTeamDto(m))), {
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
  const member = await prisma.teamMember
    .create({
      data: {
        name: "Novo Membro",
        role: "Cargo",
        sector: "Setor",
        ...parseTeamInput(body),
        ...(await adminGroupChange(body.crmAdmin, null)),
        order: await prisma.teamMember.count(),
      },
      include: teamInclude,
    })
    .catch(emailTakenResponse);
  if (member instanceof Response) return member;
  return NextResponse.json(toTeamDto(member), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Reorder: receives the full ordered array of ids
  const { order } = (await req.json()) as { order: string[] };
  if (!Array.isArray(order)) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  await prisma.$transaction(order.map((id, idx) => prisma.teamMember.update({ where: { id }, data: { order: idx } })));
  const team = await prisma.teamMember.findMany({ orderBy: { order: "asc" }, include: teamInclude });
  return NextResponse.json(team.map((m) => toTeamDto(m)));
}
