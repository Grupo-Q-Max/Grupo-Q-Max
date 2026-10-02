import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Latest notifications of a team member (`?memberId=`) and how many are unread. */
export async function GET(req: Request) {
  const memberId = new URL(req.url).searchParams.get("memberId");
  if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });

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

/** Marks one notification (`{ memberId, id }`) or all of the member's (`{ memberId }`) as read. */
export async function PATCH(req: Request) {
  try {
    const { memberId, id } = await req.json();
    if (!memberId) return NextResponse.json({ error: "Missing memberId" }, { status: 400 });
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
