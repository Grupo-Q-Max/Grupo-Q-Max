import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, readSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/settings";

// These authenticate on their own (webhook token / CRON_SECRET / QXBACK_TOKEN / QXSIGN_TOKEN / CRM_API_TOKEN) and are called by other servers
const PUBLIC_API = ["/api/crm/hook/", "/api/crm/automation/cron", "/api/crm/qxback/", "/api/crm/qxsign/", "/api/crm/tasks", "/api/crm/lead-webhook"];
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
 * CRM pages, /integracao and CRM APIs require a signed-in team member; editing the team requires the site admin;
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
    return isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value) ? NextResponse.next() : unauthorized();
  }

  if (readSession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) return unauthorized();
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // /integracao is the internal onboarding page: same sign-in as the CRM
  matcher: ["/crm/:path*", "/integracao/:path*", "/api/crm/:path*", "/api/team/:path*", "/api/auth/:path*"],
};
