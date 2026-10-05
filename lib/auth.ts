import type { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * CRM session: cookie `memberId.expiresAt.signature`, signed with AUTH_SECRET. No DB lookup per request.
 * Members sign in only with Microsoft (POST /api/auth/microsoft, lib/microsoft-auth.ts).
 */
export const SESSION_COOKIE = "qmax_crm_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// ponytail: falls back to DATABASE_URL (also server-only) so deploys without AUTH_SECRET keep working
const secret = () => process.env.AUTH_SECRET || process.env.DATABASE_URL || "";

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Signed `memberId.expiresAt.signature`; `purpose` is signed too, so a token of one kind never works as another. */
function createToken(purpose: string, memberId: string, maxAge: number) {
  const payload = `${memberId}.${Math.floor(Date.now() / 1000) + maxAge}`;
  return `${payload}.${sign(`${purpose}:${payload}`)}`;
}

/** Member id of a valid, unexpired token of `purpose`, else null. */
function readToken(purpose: string, token: string | undefined) {
  const [memberId, expiresAt, signature] = (token ?? "").split(".");
  if (!memberId || !expiresAt || !signature) return null;
  if (!sameText(sign(`${purpose}:${memberId}.${expiresAt}`), signature)) return null;
  return Number(expiresAt) * 1000 > Date.now() ? memberId : null;
}

export const createSession = (memberId: string) => createToken("session", memberId, SESSION_MAX_AGE);
export const readSession = (token: string | undefined) => readToken("session", token);

/** Signs `memberId` in on `res`. */
export function setSessionCookie(res: NextResponse, memberId: string) {
  res.cookies.set(SESSION_COOKIE, createSession(memberId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}

/** Member id of the request's session (route handlers). */
export function sessionMemberId(req: Request) {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return readSession(match?.[1]);
}
