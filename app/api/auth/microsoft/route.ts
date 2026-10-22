import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";
import { AuthError, findOrCreateMember, microsoftConfig, microsoftJwks, verifyMicrosoftIdToken } from "@/lib/microsoft-auth";
import { syncMicrosoftPhoto } from "@/lib/microsoft-photo";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const CLIENT_MESSAGE = {
  401: "Não foi possível validar o login com a Microsoft. Tente novamente.",
  403: "Sua conta Microsoft não tem acesso ao CRM. Fale com o administrador.",
} as const;

/**
 * Signs in with `{ idToken }` from MSAL; the optional Graph `accessToken` only copies the profile photo. Anything else in the body (e-mail, name...) is ignored:
 * the identity comes only from the validated token. Every attempt goes to AuthLog, without tokens.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent")?.slice(0, 512) || null;
  const audit = (success: boolean, reason: string, email?: string, memberId?: string) =>
    prisma.authLog
      .create({ data: { success, reason, email: email?.slice(0, 191), memberId, ip, userAgent } })
      .catch((error) => console.error("[auth/microsoft] audit log failed", error));

  const wait = await rateLimit(`microsoft:ip:${ip}`, 20, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  let config;
  try {
    config = microsoftConfig();
  } catch (error) {
    console.error("[auth/microsoft]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "O login com Microsoft não está configurado." }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { idToken, accessToken } = body && typeof body === "object" ? (body as { idToken?: unknown; accessToken?: unknown }) : {};
  if (typeof idToken !== "string" || !idToken) {
    await audit(false, "invalid_request");
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  try {
    const identity = await verifyMicrosoftIdToken(idToken, config, microsoftJwks(config.tenantId));
    const member = await findOrCreateMember(prisma, identity);
    await audit(true, "ok", identity.email, member.id);
    await syncMicrosoftPhoto(member, accessToken);
    return setSessionCookie(NextResponse.json({ id: member.id, name: member.name, email: member.email }), member.id);
  } catch (error) {
    if (!(error instanceof AuthError)) {
      console.error("[auth/microsoft]", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
    // The real reason stays on the server; the client gets a generic message
    console.warn(`[auth/microsoft] refused (${error.reason}): ${error.detail}`);
    await audit(false, error.reason, error.email, error.memberId);
    return NextResponse.json({ error: CLIENT_MESSAGE[error.status] }, { status: error.status });
  }
}
