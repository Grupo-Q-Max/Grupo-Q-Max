import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sessionMemberId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Latest notifications of the signed-in member and how many are unread. */
export async function GET(req: Request) {
  const memberId = sessionMemberId(req);
  if (!memberId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [items, unread] = await Promise.all([
      prisma.crmNotification.findMany({
        where: { memberId },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { card: { select: { number: true, title: true } } },
      }),
      prisma.crmNotification.count({ where: { memberId, readAt: null } }),
    ]);
    return NextResponse.json({ items, unread });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** Marks one notification (`{ id }`) or all of the signed-in member's (`{}`) as read. */
export async function PATCH(req: Request) {
  const memberId = sessionMemberId(req);
  if (!memberId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await req.json();
    await prisma.crmNotification.updateMany({
      where: { memberId, readAt: null, ...(id && { id }) },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
