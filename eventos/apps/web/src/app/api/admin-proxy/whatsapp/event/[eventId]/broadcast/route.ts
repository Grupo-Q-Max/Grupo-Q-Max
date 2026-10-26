import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  canAccessAdminApi,
  readAdminSession,
} from "@/lib/admin-session";

function getCandidateTargets(eventId: string): string[] {
  const envUrl = (process.env.FINORA_INTERNAL_API_URL || "").replace(/\/+$/, "");
  const candidates: string[] = [];

  if (envUrl) {
    const withV1 = envUrl.endsWith("/api/v1") ? envUrl : `${envUrl}/api/v1`;
    candidates.push(`${withV1}/whatsapp/event/${eventId}/broadcast`);
    candidates.push(`${envUrl}/whatsapp/event/${eventId}/broadcast`);
  }

  candidates.push(`http://127.0.0.1:3334/api/v1/whatsapp/event/${eventId}/broadcast`);
  candidates.push(`http://localhost:3334/api/v1/whatsapp/event/${eventId}/broadcast`);

  return candidates;
}

async function handleBroadcast(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  const session = readAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ message: "Sessão administrativa necessária." }, { status: 401 });
  }

  const { eventId } = await context.params;
  if (!/^\d+$/.test(eventId)) {
    return NextResponse.json({ message: "Evento inválido." }, { status: 400 });
  }

  if (!canAccessAdminApi(session, "POST", `whatsapp/event/${eventId}/broadcast`)) {
    return NextResponse.json({ message: "Seu perfil não tem acesso a esta operação." }, { status: 403 });
  }

  const adminKey = process.env.FINORA_ADMIN_API_KEY;
  if (!adminKey) {
    return NextResponse.json({ message: "API administrativa não configurada." }, { status: 503 });
  }

  let bodyData: any = {};
  if (request.method !== "GET") {
    try {
      bodyData = await request.json();
    } catch {
      bodyData = {};
    }
  }

  const targets = getCandidateTargets(eventId);
  let lastError: Error | null = null;
  let lastResponse: NextResponse | null = null;

  for (const target of targets) {
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-finora-admin-key": adminKey,
          "x-finora-admin-user-id": String(session.uid),
          Accept: "application/json",
        },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return NextResponse.json(data, { status: res.status });
      }

      lastResponse = NextResponse.json(data, { status: res.status });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  return NextResponse.json(
    {
      success: false,
      message: lastError ? lastError.message : "Falha ao conectar com o serviço de WhatsApp.",
    },
    { status: 500 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
) {
  return handleBroadcast(request, context);
}
