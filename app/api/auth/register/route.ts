import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createVerifyToken, hashPassword } from "@/lib/auth";
import { appUrl, escapeHtml, sendMail } from "@/lib/mail";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { emailTakenResponse } from "@/lib/team";

export const dynamic = "force-dynamic";

const SIGNUP_DOMAIN = "@grupoqmax.com.br";
const MIN_PASSWORD = 8;

/**
 * Self sign-up with `{ name, email, password }` for company e-mails. The account only signs in after the
 * link sent to the e-mail is confirmed (/verify). Signing up again with an unconfirmed e-mail replaces
 * its password and resends the link, so nobody can lock an address they don't own.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });
  if (!email.endsWith(SIGNUP_DOMAIN) || email.length <= SIGNUP_DOMAIN.length) {
    return NextResponse.json({ error: `Use seu e-mail ${SIGNUP_DOMAIN}` }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }

  // Each valid attempt sends an e-mail: cap per client and per address
  const wait = rateLimit(`register:ip:${clientIp(req)}`, 5, 15 * 60_000) ?? rateLimit(`register:email:${email}`, 3, 60 * 60_000);
  if (wait) return tooManyRequests(wait);

  const existing = await prisma.teamMember.findUnique({ where: { email } });
  if (existing?.emailVerifiedAt && existing.passwordHash) {
    return NextResponse.json({ error: "Este e-mail já tem cadastro. Faça login." }, { status: 409 });
  }

  const member = await (existing
    ? prisma.teamMember.update({
        where: { id: existing.id },
        // a new password always needs the e-mail confirmed again
        data: { passwordHash: hashPassword(password), emailVerifiedAt: null },
      })
    : prisma.teamMember.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role: "",
          showOnSite: false,
          order: await prisma.teamMember.count(),
        },
      })
  ).catch(emailTakenResponse);
  if (member instanceof Response) return member;

  const link = `${appUrl(req)}/verify?token=${encodeURIComponent(createVerifyToken(member.id))}`;
  try {
    await sendMail(
      email,
      "Confirme seu cadastro no Q-Max CRM",
      `<p>Olá, ${escapeHtml(member.name)}!</p>
       <p>Para ativar seu acesso ao Q-Max CRM, confirme seu e-mail:</p>
       <p><a href="${link}">Confirmar e-mail</a></p>
       <p>O link vale por 24 horas. Se não foi você, ignore este e-mail.</p>`
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Não foi possível enviar o e-mail de confirmação. Tente novamente." }, { status: 502 });
  }

  return NextResponse.json({ pending: true }, { status: 201 });
}
