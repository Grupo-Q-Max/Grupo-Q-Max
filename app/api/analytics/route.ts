import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { path, referrer, userAgent } = await req.json();

    // Prevent saving useless dev-server noise
    if (path?.includes("_next") || path?.includes("favicon")) {
      return NextResponse.json({ ignored: true });
    }

    const visit = await prisma.pageVisit.create({
      data: {
        path: path || "/",
        referrer: referrer || "Direto",
        userAgent: userAgent || "Desconhecido",
      },
    });

    return NextResponse.json({ success: true, visit });
  } catch (error) {
    return NextResponse.json({ error: "Failed to track" }, { status: 500 });
  }
}

import { cookies } from "next/headers";
import { isAdminToken } from "@/lib/settings";
import { ADMIN_COOKIE } from "@/lib/auth";

export async function GET() {
  const cookieStore = await cookies();
  if (!isAdminToken(cookieStore.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    // Get last 100 visits
    const visits = await prisma.pageVisit.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(visits);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch visits" }, { status: 500 });
  }
}
