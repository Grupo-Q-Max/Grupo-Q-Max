import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailTakenResponse, parsePartnerInput, parseTeamInput, teamInclude, toPublicTeamDto, toTeamDto } from "@/lib/team";
import { adminGroupChange } from "@/lib/crm-access";
import { ADMIN_COOKIE, sessionMemberId } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" };

/**
 * Whole team for the admin and CRM users. The public site (and `?site`, which the site section always sends, so
 * a signed-in user sees the same) only gets the partners shown on it, without login data.
 */
export async function GET(req: NextRequest) {
  const internal = Boolean(sessionMemberId(req)) || isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
  const orderBy = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  try {
    if (!internal || req.nextUrl.searchParams.has("site")) {
      const partners = await prisma.teamMember.findMany({
        where: { partner: { is: { visible: true } } },
        orderBy,
        include: { partner: true },
      });
      return NextResponse.json(
        partners.map((m) => toPublicTeamDto({ ...m, partner: m.partner! })),
        { headers: noStore }
      );
    }
    const team = await prisma.teamMember.findMany({ orderBy, include: teamInclude });
    return NextResponse.json(team.map(toTeamDto), { headers: noStore });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

/** Creates a member; with `partner` in the body it is a partner (sócio), else an employee. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const partner = parsePartnerInput(body);
  const member = await prisma.teamMember
    .create({
      data: {
        name: "Novo Membro",
        role: "Cargo",
        sector: "Setor",
        ...parseTeamInput(body),
        ...(await adminGroupChange(body.crmAdmin, null)),
        order: await prisma.teamMember.count(),
        ...(partner && { partner: { create: partner } }),
      },
      include: teamInclude,
    })
    .catch(emailTakenResponse);
  if (member instanceof Response) return member;
  return NextResponse.json(toTeamDto(member), { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Reorder: receives the ordered ids of one list (partners or employees)
  const { order } = (await req.json()) as { order: string[] };
  if (!Array.isArray(order)) return NextResponse.json({ error: "Missing order" }, { status: 400 });

  await prisma.$transaction(order.map((id, idx) => prisma.teamMember.update({ where: { id }, data: { order: idx } })));
  return NextResponse.json({ ok: true });
}
