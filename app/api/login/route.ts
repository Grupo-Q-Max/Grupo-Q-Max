import { NextRequest, NextResponse } from "next/server";
import { samePassword, setAdminCookie } from "@/lib/auth";
import { adminCookieKey, adminPassword, isTempAdminPassword } from "@/lib/settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const wait = await rateLimit(`admin:ip:${clientIp(req)}`, 10, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const { password } = await req.json().catch(() => ({}));
  if (!samePassword(password, adminPassword()) && !isTempAdminPassword(password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  return setAdminCookie(NextResponse.json({ success: true }), adminCookieKey());
}
