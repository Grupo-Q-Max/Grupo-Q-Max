import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionMemberId, setSessionCookie, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Signed-in member (`{ id, name }`) or 401. */
export async function GET(req: Request) {
  const id = sessionMemberId(req);
  const member = id && (await prisma.teamMember.findUnique({ where: { id }, select: { id: true, name: true } }));
  return member ? NextResponse.json(member) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Login with `{ email, password }`. */
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Informe e-mail e senha" }, { status: 400 });
  }

  // Password guessing: cap per client and per account (a blocked account unlocks by itself after the window)
  const normalized = email.trim().toLowerCase();
  const wait = rateLimit(`login:ip:${clientIp(req)}`, 10, 15 * 60_000) ?? rateLimit(`login:email:${normalized}`, 5, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const member = await prisma.teamMember.findUnique({ where: { email: normalized } });
  if (!member || !verifyPassword(password, member.passwordHash)) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 });
  }
  if (!member.emailVerifiedAt) {
    return NextResponse.json({ error: "Confirme seu e-mail pelo link que enviamos antes de entrar" }, { status: 403 });
  }

  return setSessionCookie(NextResponse.json({ id: member.id, name: member.name }), member.id);
}

/** Logout. */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
