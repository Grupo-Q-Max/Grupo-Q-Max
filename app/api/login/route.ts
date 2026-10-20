import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createAdminToken, samePassword, SESSION_MAX_AGE } from "@/lib/auth";
import { adminPassword } from "@/lib/settings";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const wait = await rateLimit(`admin:ip:${clientIp(req)}`, 10, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const { password } = await req.json().catch(() => ({}));
  const expected = adminPassword();
  if (!samePassword(password, expected)) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, createAdminToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
