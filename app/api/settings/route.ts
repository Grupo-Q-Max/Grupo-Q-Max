import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs";
import path from "path";
import { getSettingsJsonPath } from "@/lib/storage";
import { adminPassword, isAdminToken, readSettings, withoutPassword } from "@/lib/settings";
import { ADMIN_COOKIE, createAdminToken, SESSION_MAX_AGE } from "@/lib/auth";

function write(data: object) {
  const p = getSettingsJsonPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

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
  write(updated);

  const res = NextResponse.json(withoutPassword(updated));
  // The admin cookie is signed with the password: re-issue it so the admin who changed it stays signed in
  if (newPassword) {
    res.cookies.set(ADMIN_COOKIE, createAdminToken(adminPassword()), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  return res;
}
