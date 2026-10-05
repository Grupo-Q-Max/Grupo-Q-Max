import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";

// These authenticate on their own (webhook token / CRON_SECRET)
const PUBLIC_API = ["/api/crm/hook/", "/api/crm/automation/cron"];

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** CRM pages and APIs require a signed-in team member; editing the team (and its CRM passwords) requires the admin. */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/team")) {
    if (req.method === "GET") return NextResponse.next();
    return isAdminToken(req.cookies.get("qmax_admin")?.value) ? NextResponse.next() : unauthorized();
  }

  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return unauthorized();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/crm/:path*", "/api/crm/:path*", "/api/team/:path*"],
};
