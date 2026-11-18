import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Prisma String columns are varchar(191)
const field = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 191) : "");

/** Keeps only the origin of a referrer URL: paths and query strings may carry personal data. */
function referrerOrigin(value: unknown) {
  const text = field(value);
  try {
    return new URL(text).origin;
  } catch {
    return text.startsWith("Direto") ? "Direto" : "";
  }
}

/**
 * Page view from PageTracker, sent only after the visitor allows statistics in the cookie banner.
 * Open endpoint: validated and rate limited per IP. Stores no IP and no user agent (data minimisation).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const path = field(body?.path).split(/[?#]/)[0];
  if (!path.startsWith("/")) return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  // Prevent saving useless dev-server noise
  if (path.includes("_next") || path.includes("favicon")) {
    return NextResponse.json({ ignored: true });
  }

  // Over the limit: drop the visit quietly, the tracker ignores the response anyway
  if (await rateLimit(`visit:ip:${clientIp(req)}`, 60, 10 * 60_000)) return new NextResponse(null, { status: 204 });

  try {
    await prisma.pageVisit.create({
      data: {
        path,
        referrer: referrerOrigin(body.referrer) || "Direto",
        userAgent: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking visit:", error);
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
    console.error("Error fetching visits:", error);
    return NextResponse.json({ error: "Failed to fetch visits" }, { status: 500 });
  }
}
