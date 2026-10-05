import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readVerifyToken, setSessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Confirms the sign-up e-mail with `{ token, password }` and signs in.
 * POST + password (not a plain GET link): mail scanners that open links can't confirm,
 * and whoever signed up someone else's address can't have the real owner confirm it for them.
 */
export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  const memberId = readVerifyToken(typeof token === "string" ? token : undefined);
  if (!memberId) {
    return NextResponse.json({ error: "Link inválido ou expirado. Cadastre-se novamente." }, { status: 400 });
  }

  const member = await prisma.teamMember.findUnique({ where: { id: memberId } });
  if (!member || typeof password !== "string" || !verifyPassword(password, member.passwordHash)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }

  if (!member.emailVerifiedAt) {
    await prisma.teamMember.update({ where: { id: member.id }, data: { emailVerifiedAt: new Date() } });
  }
  return setSessionCookie(NextResponse.json({ id: member.id, name: member.name }), member.id);
}
