import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, readInviteToken, setSessionCookie } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;

/**
 * Accepts a CRM invitation with `{ token, password }`: sets the password, confirms the e-mail (the link
 * reached it) and signs in. A link stops working once its account has a confirmed login.
 */
export async function POST(req: Request) {
  const wait = rateLimit(`invite:ip:${clientIp(req)}`, 10, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const { token, password } = await req.json().catch(() => ({}));
  const memberId = readInviteToken(typeof token === "string" ? token : undefined);
  if (!memberId) {
    return NextResponse.json({ error: "Convite inválido ou expirado. Peça um novo convite ao administrador." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return NextResponse.json({ error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
  }

  const member = await prisma.teamMember.findUnique({ where: { id: memberId }, select: { id: true, name: true } });
  if (!member) {
    return NextResponse.json({ error: "Convite cancelado. Peça um novo convite ao administrador." }, { status: 400 });
  }

  // Conditional update: of two simultaneous accepts, only the first sets the password
  const { count } = await prisma.teamMember.updateMany({
    where: { id: member.id, OR: [{ emailVerifiedAt: null }, { passwordHash: null }] },
    data: { passwordHash: hashPassword(password), emailVerifiedAt: new Date() },
  });
  if (!count) return NextResponse.json({ error: "Este convite já foi usado. Faça login." }, { status: 409 });
  return setSessionCookie(NextResponse.json(member), member.id);
}
