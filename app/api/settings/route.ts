import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCookieKey, isAdminToken, readSettings, withoutPassword, writeSettings } from "@/lib/settings";
import { ADMIN_COOKIE, setAdminCookie } from "@/lib/auth";

const isAdmin = async () => isAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);

export async function GET() {
  return NextResponse.json(withoutPassword(readSettings()));
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = readSettings();
  // An empty password field means "keep the current one"
  const newPassword = typeof body.adminPassword === "string" && body.adminPassword.trim() ? body.adminPassword : null;
  if (newPassword && newPassword.length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  const updated = { ...current, ...body, adminPassword: newPassword ?? current.adminPassword };
  writeSettings(updated);

  const res = NextResponse.json(withoutPassword(updated));
  // The admin cookie is signed with the password: re-issue it so the admin who changed it stays signed in
  if (newPassword) setAdminCookie(res, adminCookieKey());
  return res;
}
