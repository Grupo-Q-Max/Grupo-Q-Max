import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getUploadsDir } from "@/lib/storage";
import { emailTakenResponse, parsePartnerInput, parseTeamInput, teamInclude, toTeamDto } from "@/lib/team";
import { adminGroupChange } from "@/lib/crm-access";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const member = await prisma.teamMember.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ ok: true });

  // CRM deals/activities keep existing: responsável becomes empty (onDelete: SetNull)
  await prisma.teamMember.delete({ where: { id } });

  // Delete the uploaded photo if it exists
  if (member.photo) {
    const filename = path.basename(member.photo.split("?")[0]);
    const imgPath = path.join(getUploadsDir(), filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    const legacyPath = path.join(process.cwd(), "public", "team", filename);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const exists = await prisma.teamMember.findUnique({
    where: { id },
    select: { crmGroupId: true, partner: { select: { memberId: true } } },
  });
  if (!exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Only partners have a site profile: `partner` in the body updates it and never turns an employee into a partner
  const partner = parsePartnerInput(body);
  const member = await prisma.teamMember
    .update({
      where: { id },
      data: {
        ...parseTeamInput(body),
        ...(await adminGroupChange(body.crmAdmin, exists.crmGroupId)),
        ...(partner && exists.partner && { partner: { update: partner } }),
      },
      include: teamInclude,
    })
    .catch(emailTakenResponse);
  if (member instanceof Response) return member;
  return NextResponse.json(toTeamDto(member));
}
