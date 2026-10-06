import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";

// These authenticate on their own (webhook token / CRON_SECRET / QXBACK_TOKEN) and are called by other servers
const PUBLIC_API = ["/api/crm/hook/", "/api/crm/automation/cron", "/api/crm/qxback/"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/**
 * CSRF: the session is a cookie, so a change request must come from this site. Browsers send
 * Origin on every cross-site POST/PUT/PATCH/DELETE; a foreign one is refused (SameSite=Lax covers
 * the rest). Compares hosts only: behind Azure the request reaches Next over http.
 */
function isCrossSite(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host !== req.headers.get("host") && host !== req.headers.get("x-forwarded-host");
  } catch {
    return true;
  }
}

/**
 * CRM pages and APIs require a signed-in team member; editing the team requires the site admin;
 * sign-in (/api/auth) is open. Changes from other sites are refused everywhere here.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!SAFE_METHODS.has(req.method) && isCrossSite(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (pathname.startsWith("/api/team")) {
    if (req.method === "GET") return NextResponse.next();
    return isAdminToken(req.cookies.get("qmax_admin")?.value) ? NextResponse.next() : unauthorized();
  }

  if (readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return unauthorized();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/crm/:path*", "/api/crm/:path*", "/api/team/:path*", "/api/auth/:path*"],
};
