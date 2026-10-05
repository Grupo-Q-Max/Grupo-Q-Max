import nodemailer from "nodemailer";

/**
 * The only place that sends e-mail (Office 365 SMTP, STARTTLS on 587). Auth order:
 * 1. OAuth2 / XOAUTH2: OAUTH_REFRESH_TOKEN is exchanged for an access token with the SMTP.Send scope.
 * 2. SMTP LOGIN with SMTP_USER / SMTP_PASS, when OAuth isn't configured or fails (logged as a fallback).
 * Failures throw: callers log them and show the user a generic message, never the SMTP error.
 */

const env = (name: string) => process.env[name]?.trim() || "";

const oauthConfigured = () =>
  Boolean(env("OAUTH_TENANT_ID") && env("OAUTH_CLIENT_ID") && env("OAUTH_CLIENT_SECRET") && env("OAUTH_REFRESH_TOKEN"));

let cachedToken: { value: string; expiresAt: number } | null = null;

/** Access token for SMTP.Send, cached until a minute before it expires. */
async function oauthAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env("OAUTH_CLIENT_ID"),
    client_secret: env("OAUTH_CLIENT_SECRET"),
    refresh_token: env("OAUTH_REFRESH_TOKEN"),
    scope: "https://outlook.office.com/SMTP.Send offline_access",
  });
  if (env("OAUTH_REDIRECT_URI")) body.set("redirect_uri", env("OAUTH_REDIRECT_URI"));

  const res = await fetch(`https://login.microsoftonline.com/${env("OAUTH_TENANT_ID")}/oauth2/v2.0/token`, {
    method: "POST",
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`token endpoint ${res.status}: ${data.error ?? ""} ${data.error_description ?? ""}`.trim());
  }

  cachedToken = { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return cachedToken.value;
}

const transport = (auth: { type: "OAuth2"; user: string; accessToken: string } | { user: string; pass: string }) =>
  nodemailer.createTransport({
    host: env("SMTP_HOST") || "smtp.office365.com",
    port: Number(env("SMTP_PORT") || 587),
    secure: env("SMTP_PORT") === "465",
    requireTLS: env("SMTP_PORT") !== "465",
    auth,
  });

/** Sender: `MAIL_FROM_NAME <MAIL_FROM>`, falling back to the SMTP mailbox. */
const sender = () => {
  const address = env("MAIL_FROM") || env("SMTP_USER");
  return env("MAIL_FROM_NAME") ? { name: env("MAIL_FROM_NAME"), address } : address;
};

export async function sendMail(to: string, subject: string, html: string) {
  if (!oauthConfigured() && !env("SMTP_HOST")) {
    if (process.env.NODE_ENV === "production") throw new Error("E-mail is not configured (OAUTH_* or SMTP_*)");
    console.log(`[mail] e-mail not configured, not sending to ${to}: ${subject}\n${html}`);
    return;
  }

  const message = { from: sender(), to, subject, html };
  const user = env("SMTP_USER") || env("MAIL_FROM");

  if (oauthConfigured()) {
    try {
      return await transport({ type: "OAuth2", user, accessToken: await oauthAccessToken() }).sendMail(message);
    } catch (error) {
      cachedToken = null;
      console.error("[OAUTH ERROR - FALLBACK TO SMTP]", error instanceof Error ? error.message : error);
      if (!env("SMTP_PASS")) throw error;
    }
  }

  const info = await transport({ user, pass: env("SMTP_PASS") }).sendMail(message);
  // Ethereal (fake SMTP for local tests) keeps the message at a preview URL; false for real servers
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log(`[mail] preview of "${subject}" to ${to}: ${preview}`);
  return info;
}
