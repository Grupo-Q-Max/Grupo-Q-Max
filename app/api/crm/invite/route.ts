import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INVITE_DAYS, createInviteToken } from "@/lib/auth";
import { denyUnless } from "@/lib/crm-access";
import { appUrl, escapeHtml, sendMail } from "@/lib/mail";
import { emailTakenResponse } from "@/lib/team";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites someone to the CRM: `{ name, email, groupId }` (`groupId: null` = default group). Creates the
 * member without a password, or updates a pending one, and e-mails a /invite link where they choose
 * the password. Inviting a pending e-mail again just resends the link.
 */
export async function POST(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const crmGroupId = typeof body.groupId === "string" && body.groupId ? body.groupId : null;
    if (!EMAIL.test(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (crmGroupId && !(await prisma.crmGroup.findUnique({ where: { id: crmGroupId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 400 });
    }

    const existing = await prisma.teamMember.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt && existing.passwordHash) {
      return NextResponse.json({ error: "Este e-mail já tem acesso ao CRM." }, { status: 409 });
    }

    const member = await (existing
      ? prisma.teamMember.update({ where: { id: existing.id }, data: { crmGroupId, ...(name && { name }) } })
      : prisma.teamMember.create({
          data: {
            name: name || email.split("@")[0],
            email,
            crmGroupId,
            role: "",
            showOnSite: false,
            order: await prisma.teamMember.count(),
          },
        })
    ).catch(emailTakenResponse);
    if (member instanceof Response) return member;

    const link = `${appUrl(req)}/invite?token=${encodeURIComponent(createInviteToken(member.id))}`;
    try {
      await sendMail(
        email,
        "Você foi convidado para o Q-Max CRM",
        `<p>Olá, ${escapeHtml(member.name)}!</p>
         <p>Você foi convidado para acessar o Q-Max CRM. Crie sua senha para entrar:</p>
         <p><a href="${link}">Aceitar convite</a></p>
         <p>O link vale por ${INVITE_DAYS} dias. Se não esperava este convite, ignore este e-mail.</p>`
      );
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Não foi possível enviar o e-mail do convite. Tente novamente." }, { status: 502 });
    }

    return NextResponse.json({ id: member.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Cancels a pending invitation (`?memberId=`): deletes the member, which invalidates the link. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("memberId") ?? "";
    const member = await prisma.teamMember.findUnique({ where: { id }, select: { emailVerifiedAt: true, showOnSite: true } });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Members shown on the public site are managed in /admin, even before they confirm a login
    if (member.emailVerifiedAt || member.showOnSite) {
      return NextResponse.json({ error: "Só convites pendentes podem ser cancelados." }, { status: 400 });
    }

    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
