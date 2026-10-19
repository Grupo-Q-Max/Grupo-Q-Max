import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { microsoftConfig } from "@/lib/microsoft-auth";
import { denyUnless } from "@/lib/crm-access";
import { appUrl, escapeHtml, sendMail } from "@/lib/mail";
import { emailTakenResponse } from "@/lib/team";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Invites someone to the CRM: `{ name, email, groupId }` (`groupId: null` = default group). Creates the
 * member, or updates a pending one (never signed in), and e-mails them to sign in with Microsoft at
 * /login: their account is linked to this member by e-mail on the first sign-in. Inviting a pending
 * e-mail again just resends the e-mail.
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
    // Only accounts of the allowed domains can sign in with Microsoft
    const { allowedDomains } = microsoftConfig();
    if (!allowedDomains.includes(email.split("@").pop()!)) {
      return NextResponse.json({ error: `Use um e-mail ${allowedDomains.map((d) => "@" + d).join(" ou ")}.` }, { status: 400 });
    }
    if (crmGroupId && !(await prisma.crmGroup.findUnique({ where: { id: crmGroupId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Grupo não encontrado." }, { status: 400 });
    }

    const existing = await prisma.teamMember.findUnique({ where: { email } });
    if (existing?.microsoftOid) {
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
            order: await prisma.teamMember.count(),
          },
        })
    ).catch(emailTakenResponse);
    if (member instanceof Response) return member;

    const link = `${appUrl(req)}/login`;
    try {
      await sendMail(
        email,
        "Você foi convidado para o Q-Max CRM",
        `<p>Olá, ${escapeHtml(member.name)}!</p>
         <p>Você foi convidado para acessar o Q-Max CRM. Entre com a sua conta Microsoft (${escapeHtml(email)}):</p>
         <p><a href="${link}">Entrar no Q-Max CRM</a></p>
         <p>Se não esperava este convite, ignore este e-mail.</p>`
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

/** Cancels a pending invitation (`?memberId=`): deletes the member, so the e-mail no longer gets access. */
export async function DELETE(req: Request) {
  try {
    const denied = await denyUnless("access.manage");
    if (denied) return denied;
    const id = new URL(req.url).searchParams.get("memberId") ?? "";
    const member = await prisma.teamMember.findUnique({ where: { id }, select: { microsoftOid: true, partner: { select: { memberId: true } } } });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
    // Partners (sócios) are managed in /admin, even before they confirm a login
    if (member.microsoftOid || member.partner) {
      return NextResponse.json({ error: "Só convites pendentes podem ser cancelados." }, { status: 400 });
    }

    await prisma.teamMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
