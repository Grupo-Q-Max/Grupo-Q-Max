// Tests of the Microsoft sign-in (lib/microsoft-auth.ts). Run: npm test
// Token checks use a local key pair as the "Microsoft" JWKS. Member checks use the local dev
// database (DATABASE_URL from .env.development.local) and are skipped when it isn't on localhost.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SignJWT, UnsecuredJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import dotenv from "dotenv";
import { AuthError, findOrCreateMember, microsoftConfig, verifyMicrosoftIdToken } from "../lib/microsoft-auth.ts";

const TENANT = randomUUID();
const CLIENT = randomUUID();
const config = { tenantId: TENANT, clientId: CLIENT, allowedDomains: ["grupoqmax.com.br"] };

const { privateKey, publicKey } = await generateKeyPair("RS256");
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256" }] });
const otherKey = (await generateKeyPair("RS256")).privateKey;

const baseClaims = (over = {}) => ({
  tid: TENANT,
  oid: randomUUID(),
  email: "pessoa@grupoqmax.com.br",
  name: "Pessoa Teste",
  ...over,
});

/** id_token as Microsoft would sign it; `opts` overrides issuer, audience, times or the signing key. */
function idToken(claims = baseClaims(), opts = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(opts.issuer ?? `https://login.microsoftonline.com/${TENANT}/v2.0`)
    .setAudience(opts.audience ?? CLIENT)
    .setIssuedAt(opts.iat ?? now)
    .setExpirationTime(opts.exp ?? now + 3600)
    .sign(opts.key ?? privateKey);
}

/** Asserts the promise rejects with an AuthError of `status` (and `reason`, when given). */
async function refused(promise, status, reason) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AuthError, `expected AuthError, got ${error}`);
    assert.equal(error.status, status);
    if (reason) assert.equal(error.reason, reason);
    return true;
  });
}

describe("verifyMicrosoftIdToken", () => {
  test("valid token returns the identity from the claims", async () => {
    const claims = baseClaims({ email: "Pessoa@GrupoQmax.com.br" });
    const identity = await verifyMicrosoftIdToken(await idToken(claims), config, keys);
    assert.deepEqual(identity, { oid: claims.oid, tid: TENANT, email: "pessoa@grupoqmax.com.br", name: "Pessoa Teste" });
  });

  test("falls back to preferred_username when there is no email claim", async () => {
    const claims = baseClaims({ email: undefined, preferred_username: "upn@grupoqmax.com.br" });
    assert.equal((await verifyMicrosoftIdToken(await idToken(claims), config, keys)).email, "upn@grupoqmax.com.br");
  });

  test("body with only an e-mail (no id_token) is refused", async () => {
    await refused(verifyMicrosoftIdToken(undefined, config, keys), 401, "invalid_request");
    await refused(verifyMicrosoftIdToken({ email: "x@grupoqmax.com.br" }, config, keys), 401, "invalid_request");
  });

  test("unsigned token (alg: none) is refused", async () => {
    const forged = new UnsecuredJWT(baseClaims())
      .setIssuer(`https://login.microsoftonline.com/${TENANT}/v2.0`)
      .setAudience(CLIENT)
      .setIssuedAt()
      .setExpirationTime("1h")
      .encode();
    await refused(verifyMicrosoftIdToken(forged, config, keys), 401, "invalid_token");
  });

  test("token signed with another key is refused", async () => {
    await refused(verifyMicrosoftIdToken(await idToken(baseClaims(), { key: otherKey }), config, keys), 401, "invalid_token");
  });

  test("token issued to another application (aud) is refused", async () => {
    await refused(verifyMicrosoftIdToken(await idToken(baseClaims(), { audience: randomUUID() }), config, keys), 401, "invalid_token");
  });

  test("token from another tenant (iss) is refused", async () => {
    const other = randomUUID();
    const token = await idToken(baseClaims({ tid: other }), { issuer: `https://login.microsoftonline.com/${other}/v2.0` });
    await refused(verifyMicrosoftIdToken(token, config, keys), 401, "invalid_token");
  });

  test("token with our issuer but another tid is refused", async () => {
    await refused(verifyMicrosoftIdToken(await idToken(baseClaims({ tid: randomUUID() })), config, keys), 401, "invalid_token");
  });

  test("expired token is refused", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await idToken(baseClaims(), { iat: now - 7200, exp: now - 3600 });
    await refused(verifyMicrosoftIdToken(token, config, keys), 401, "invalid_token");
  });

  test("old token still within its exp (replay) is refused", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await idToken(baseClaims(), { iat: now - 30 * 60, exp: now + 30 * 60 });
    await refused(verifyMicrosoftIdToken(token, config, keys), 401, "invalid_token");
  });

  test("token without oid is refused", async () => {
    await refused(verifyMicrosoftIdToken(await idToken(baseClaims({ oid: undefined })), config, keys), 401, "invalid_token");
  });

  test("e-mail outside the allowed domains is refused with 403", async () => {
    const token = await idToken(baseClaims({ email: "pessoa@qmax.com.br" }));
    await refused(verifyMicrosoftIdToken(token, config, keys), 403, "domain_not_allowed");
  });
});

describe("microsoftConfig", () => {
  const env = { MICROSOFT_TENANT_ID: TENANT, MICROSOFT_CLIENT_ID: CLIENT, MICROSOFT_ALLOWED_DOMAINS: " GrupoQmax.com.br , " };

  test("reads and normalizes the environment", () => {
    assert.deepEqual(microsoftConfig(env), config);
  });

  test("throws when a variable is missing (no defaults)", () => {
    assert.throws(() => microsoftConfig({ ...env, MICROSOFT_ALLOWED_DOMAINS: "" }), /MICROSOFT_ALLOWED_DOMAINS/);
    assert.throws(() => microsoftConfig({}), /MICROSOFT_TENANT_ID/);
  });

  test("rejects the multi-tenant authorities", () => {
    assert.throws(() => microsoftConfig({ ...env, MICROSOFT_TENANT_ID: "common" }), /GUID/);
    assert.throws(() => microsoftConfig({ ...env, MICROSOFT_TENANT_ID: "organizations" }), /GUID/);
  });
});

dotenv.config({ path: ".env.development.local", quiet: true });
const localDb = /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? "");

describe("findOrCreateMember (local database)", { skip: !localDb && "DATABASE_URL is not a local database" }, () => {
  let db, pool;
  const prefix = `sso-test-${Date.now()}`;
  const identity = (over = {}) => ({ oid: randomUUID(), tid: TENANT, email: `${prefix}-${randomUUID().slice(0, 8)}@grupoqmax.com.br`, name: "SSO Teste", ...over });

  before(async () => {
    const [{ PrismaClient }, { PrismaMariaDb }, { default: mariadb }] = await Promise.all([
      import("@prisma/client"),
      import("@prisma/adapter-mariadb"),
      import("mariadb"),
    ]);
    pool = mariadb.createPool(process.env.DATABASE_URL.replace("mysql://", "mariadb://"));
    db = new PrismaClient({ adapter: new PrismaMariaDb(pool) });
  });

  after(async () => {
    await db?.teamMember.deleteMany({ where: { email: { startsWith: prefix } } });
    await db?.$disconnect();
    await pool?.end(); // the adapter doesn't own the pool; an open pool keeps the test process alive
  });

  test("first sign-in creates the member in the default group, hidden from the site", async () => {
    const who = identity();
    const member = await findOrCreateMember(db, who);
    assert.equal(member.email, who.email);
    assert.equal(member.microsoftOid, who.oid);
    assert.equal(member.microsoftTid, TENANT);
    assert.equal(member.crmGroupId, null);
    assert.equal(await db.teamPartner.count({ where: { memberId: member.id } }), 0);
    assert.equal(member.passwordHash, null);
  });

  test("next sign-in finds the same member by oid, even after the e-mail changed", async () => {
    const who = identity();
    const first = await findOrCreateMember(db, who);
    const again = await findOrCreateMember(db, { ...who, email: `${prefix}-renamed-${randomUUID().slice(0, 8)}@grupoqmax.com.br` });
    assert.equal(again.id, first.id);
  });

  test("links the member the admin created with that e-mail", async () => {
    const who = identity();
    const invited = await db.teamMember.create({ data: { name: "Convidado", email: who.email, role: "" } });
    const member = await findOrCreateMember(db, who);
    assert.equal(member.id, invited.id);
    assert.equal(member.microsoftOid, who.oid);
  });

  test("an e-mail already linked to another Microsoft account is refused with 403", async () => {
    const who = identity();
    await findOrCreateMember(db, who);
    await refused(findOrCreateMember(db, { ...who, oid: randomUUID() }), 403, "account_conflict");
  });

  test("a blocked member is refused with 403", async () => {
    const who = identity();
    const member = await findOrCreateMember(db, who);
    await db.teamMember.update({ where: { id: member.id }, data: { crmActive: false } });
    await refused(findOrCreateMember(db, who), 403, "inactive");
  });
});
