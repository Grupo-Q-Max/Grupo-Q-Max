import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionMemberId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Signed-in member (`{ id, name }`) or 401. Sign-in itself is POST /api/auth/microsoft. */
export async function GET(req: Request) {
  const id = sessionMemberId(req);
  const member =
    id && (await prisma.teamMember.findFirst({ where: { id, crmActive: true }, select: { id: true, name: true } }));
  return member ? NextResponse.json(member) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Logout. */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
