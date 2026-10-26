import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, any> = {};

    if (rawBody) {
      const trimmed = rawBody.trim();

      try {
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === "object") {
            body = parsed;
          }
        } else {
          body = Object.fromEntries(new URLSearchParams(trimmed));
        }
      } catch {
        try {
          body = Object.fromEntries(new URLSearchParams(trimmed));
        } catch {
          body = {};
        }
      }
    }

    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");

    if (!username || !password) {
      return NextResponse.json(
        { message: "Informe o usuário e a senha." },
        { status: 400 },
      );
    }

    const apiUrl = process.env.FINORA_INTERNAL_API_URL || "http://localhost:3334/api/v1";
    let adminData: any = null;

    try {
      const apiRes = await fetch(`${apiUrl}/admin-users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // A API limita tentativas de login por IP; sem isso todo admin seria 127.0.0.1.
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
        },
        body: JSON.stringify({ username, password }),
      });

      if (apiRes.ok) {
        adminData = await apiRes.json();
      }
    } catch {
      // API indisponível: trata como falha de login
    }

    if (!adminData) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return NextResponse.json(
        { message: "Usuário ou senha inválidos." },
        { status: 401 },
      );
    }

    const sessionToken = createAdminSession(Number(adminData.id), adminData.role);

    if (!sessionToken) {
      console.error("[admin-auth/login] FINORA_ADMIN_SESSION_TOKEN não configurada.");
      return NextResponse.json(
        { message: "Login administrativo indisponível." },
        { status: 503 },
      );
    }

    const response = NextResponse.json({
      success: true,
      user: adminData,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[admin-auth/login] Erro inesperado:", error);
    return NextResponse.json(
      { message: "Não foi possível realizar o login." },
      { status: 500 },
    );
  }
}

