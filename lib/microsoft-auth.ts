import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { Prisma, type PrismaClient, type TeamMember } from "@prisma/client";

/**
 * CRM sign-in with Microsoft Entra ID. The browser gets an id_token (MSAL, Authorization Code + PKCE)
 * and posts only that token; identity comes exclusively from its claims, validated here.
 * No "@/" imports: tests/microsoft-auth.test.mjs runs this file directly with Node.
 */

export type MicrosoftConfig = { tenantId: string; clientId: string; allowedDomains: string[] };
export type MicrosoftIdentity = { oid: string; tid: string; email: string; name: string };

/** Sign-in refused: `status` goes to the client with a generic message, `reason` to the logs and AuthLog. */
export class AuthError extends Error {
  status: 401 | 403;
  reason: string;
  detail: string;
  email?: string;
  memberId?: string;

  constructor(status: 401 | 403, reason: string, detail = reason, email?: string, memberId?: string) {
    super(detail);
    this.status = status;
    this.reason = reason;
    this.detail = detail;
    this.email = email;
    this.memberId = memberId;
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUIRED_ENV = ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_ALLOWED_DOMAINS"] as const;

/** Configuration from the environment. Throws when anything is missing; there are no defaults. */
export function microsoftConfig(env: Record<string, string | undefined> = process.env): MicrosoftConfig {
  const missing = REQUIRED_ENV.filter((name) => !env[name]?.trim());
  if (missing.length) throw new Error(`Microsoft sign-in is not configured: missing ${missing.join(", ")}`);

  const tenantId = env.MICROSOFT_TENANT_ID!.trim().toLowerCase();
  const clientId = env.MICROSOFT_CLIENT_ID!.trim().toLowerCase();
  // A GUID also rules out the multi-tenant "common" / "organizations" authorities
  if (!GUID.test(tenantId) || !GUID.test(clientId)) {
    throw new Error("MICROSOFT_TENANT_ID and MICROSOFT_CLIENT_ID must be GUIDs");
  }
  const allowedDomains = env
    .MICROSOFT_ALLOWED_DOMAINS!.split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return { tenantId, clientId, allowedDomains };
}

let remoteKeys: { tenantId: string; keys: JWTVerifyGetKey } | null = null;

/** Signing keys of the tenant; jose caches them and refetches when Microsoft rotates them. */
export function microsoftJwks(tenantId: string) {
  if (remoteKeys?.tenantId !== tenantId) {
    remoteKeys = {
      tenantId,
      keys: createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)),
    };
  }
  return remoteKeys.keys;
}

/** Validates signature, issuer, audience, expiry and tenant of an id_token, then the e-mail domain. */
export async function verifyMicrosoftIdToken(
  idToken: unknown,
  config: MicrosoftConfig,
  keys: JWTVerifyGetKey
): Promise<MicrosoftIdentity> {
  if (typeof idToken !== "string" || !idToken) throw new AuthError(401, "invalid_request", "missing id_token");

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
      audience: config.clientId,
      algorithms: ["RS256"],
      clockTolerance: 60,
      // The browser posts the token right after the popup: an old one can only be a replay
      maxTokenAge: "10 minutes",
      requiredClaims: ["exp", "iat", "tid", "oid"],
    }));
  } catch (error) {
    throw new AuthError(401, "invalid_token", error instanceof Error ? error.message : String(error));
  }

  if (payload.tid !== config.tenantId) throw new AuthError(401, "invalid_token", `tenant ${payload.tid}`);

  const oid = typeof payload.oid === "string" ? payload.oid : "";
  const email = String(payload.email ?? payload.preferred_username ?? "").trim().toLowerCase();
  if (!oid || !email.includes("@")) throw new AuthError(401, "invalid_token", "token without oid or e-mail");

  if (!config.allowedDomains.includes(email.split("@").pop()!)) {
    throw new AuthError(403, "domain_not_allowed", `domain of ${email}`, email);
  }
  return { oid, tid: payload.tid, email, name: String(payload.name ?? "").trim() };
}

// Local copy of lib/prisma-errors: tests load this file without the "@/" alias.
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * The member of a validated identity: found by (tid, oid); on the first sign-in, linked by e-mail to
 * the member the admin created or invited; otherwise created in the default group (crmGroupId null),
 * hidden from the public site. Blocked members are refused.
 */
export async function findOrCreateMember(db: PrismaClient, identity: MicrosoftIdentity, retried = false): Promise<TeamMember> {
  const { oid, tid, email, name } = identity;
  try {
    let member = await db.teamMember.findUnique({ where: { microsoftTid_microsoftOid: { microsoftTid: tid, microsoftOid: oid } } });

    if (!member) {
      const byEmail = await db.teamMember.findUnique({ where: { email } });
      if (byEmail?.microsoftOid) {
        // The address now belongs to another Microsoft account (e-mails can be reused): don't hand over the member
        throw new AuthError(403, "account_conflict", `${email} is linked to another Microsoft account`, email, byEmail.id);
      }
      member = byEmail
        ? await db.teamMember.update({ where: { id: byEmail.id }, data: { microsoftOid: oid, microsoftTid: tid } })
        : await db.teamMember.create({
            data: {
              name: name || email.split("@")[0],
              email,
              role: "",
              order: await db.teamMember.count(),
              microsoftOid: oid,
              microsoftTid: tid,
            },
          });
    }

    if (!member.crmActive) throw new AuthError(403, "inactive", `member ${member.id} is blocked`, email, member.id);
    return member;
  } catch (error) {
    // Two first sign-ins at once: the other request created/linked the member; read it again
    if (!retried && isUniqueViolation(error)) return findOrCreateMember(db, identity, true);
    throw error;
  }
}
