import { NextRequest, NextResponse } from "next/server";
import { createAdminResetToken, readAdminResetToken, setAdminCookie } from "@/lib/auth";
import { adminCookieKey, adminEmails, adminPassword, readSettings, writeSettings } from "@/lib/settings";
import { appUrl, sendMail } from "@/lib/mail";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * `{ email }`: e-mails a link to set the /admin password, only when the e-mail is in ADMIN_EMAILS.
 * The answer is the same either way, so it never tells which e-mails are admins.
 */
export async function POST(req: NextRequest) {
  const wait = await rateLimit(`admin-reset:ip:${clientIp(req)}`, 5, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const { email } = await req.json().catch(() => ({}));
  const address = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (address && adminEmails().includes(address)) {
    const link = `${appUrl(req)}/admin?reset=${createAdminResetToken(adminPassword())}`;
    try {
      await sendMail(
        address,
        "Criar senha de acesso ao admin — Grupo Q-Max",
        `<p>Recebemos um pedido para criar uma nova senha de acesso à área administrativa (/admin).</p>
         <p><a href="${link}">Criar nova senha</a></p>
         <p>O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você, ignore este e-mail.</p>`
      );
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Não foi possível enviar o e-mail. Tente novamente." }, { status: 502 });
    }
  }
  return NextResponse.json({ success: true });
}

/** `{ token, password }`: sets the /admin password from the e-mailed link and signs the admin in. */
export async function PUT(req: NextRequest) {
  const wait = await rateLimit(`admin-reset:ip:${clientIp(req)}`, 5, 15 * 60_000);
  if (wait) return tooManyRequests(wait);

  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !readAdminResetToken(token, adminPassword())) {
    return NextResponse.json({ error: "Link inválido ou expirado. Peça um novo." }, { status: 400 });
  }
  if (typeof password !== "string" || password.trim().length < 8) {
    return NextResponse.json({ error: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  writeSettings({ ...readSettings(), adminPassword: password });
  return setAdminCookie(NextResponse.json({ success: true }), adminCookieKey());
}
