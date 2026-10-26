import {
  NextRequest,
  NextResponse,
} from "next/server";
import { adminHome, canAccessAdminPage } from "@/lib/admin-access";
import {
  ADMIN_SESSION_COOKIE,
  readAdminSession,
} from "@/lib/admin-session";

export function proxy(
  request: NextRequest,
) {
  const pathname =
    request.nextUrl.pathname;

  if (pathname === '/favicon.ico' || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const session = readAdminSession(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/admin/login/';
    loginUrl.searchParams.set('next', pathname.endsWith('/') ? pathname : `${pathname}/`);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessAdminPage(session.role, pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = adminHome(session.role);
    homeUrl.search = '';
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
  ],
};
