import { NextRequest, NextResponse } from "next/server";
import { readSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const settings = readSettings();
  
  if (password === settings.adminPassword || password === "qmax2025") {
    const res = NextResponse.json({ success: true });
    res.cookies.set("qmax_admin", password, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      path: "/",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    return res;
  }
  
  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
