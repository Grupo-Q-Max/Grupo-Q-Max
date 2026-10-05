// End-to-end check of improvement request notifications against the running dev server.
// A temporary "Conta de teste" member sends a request to an area through POST /api/crm/request;
// every active member of that area must get a notification in the CRM bell. The test member is
// removed at the end; the request and the notifications stay so they show up in the bell.
// Run (dev server up, local DB only): node --env-file=.env.development.local scripts/check-request-notification.mjs [AREA]
// AREA: MARKETING | TECHNOLOGY | OTHER (default TECHNOLOGY). Session secret = AUTH_SECRET || DATABASE_URL, like lib/auth.ts.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import mariadb from "mariadb";

const BASE = process.env.CHECK_URL || "http://localhost:3000";
const area = process.argv[2] || "TECHNOLOGY";
const dbUrl = process.env.DATABASE_URL;
assert.ok(dbUrl?.includes("localhost"), "DATABASE_URL must point to the local DB");

const secret = process.env.AUTH_SECRET || dbUrl;
const session = (memberId) => {
  const payload = `${memberId}.${Math.floor(Date.now() / 1000) + 600}`;
  return `${payload}.${createHmac("sha256", secret).update(`session:${payload}`).digest("base64url")}`;
};

const db = await mariadb.createConnection(dbUrl.replace("mysql://", "mariadb://"));
const testId = `test-${randomUUID()}`;
try {
  // Expected recipients, before the test member exists (it has no area, so it is never one of them)
  const expected = await db.query(
    area === "OTHER"
      ? `SELECT t.id, t.name FROM TeamMember t JOIN CrmGroup g ON g.id = t.crmGroupId
         WHERE t.crmActive = 1 AND (g.isAdmin = 1 OR EXISTS (SELECT 1 FROM CrmGroupPermission p WHERE p.groupId = g.id AND p.permission = 'request.manage'))`
      : "SELECT id, name FROM TeamMember WHERE crmActive = 1 AND area = ?",
    [area]
  );
  console.log(`Area ${area}: ${expected.length} member(s) to notify: ${expected.map((m) => m.name).join(", ") || "none"}`);

  await db.query(
    "INSERT INTO TeamMember (id, name, role, sector, accentColor, `order`, crmActive, showOnSite, createdAt, updatedAt) VALUES (?, 'Conta de teste', '', '', '#14d0c1', 0, 1, 0, NOW(3), NOW(3))",
    [testId]
  );

  const title = `Teste de notificação ${new Date().toLocaleTimeString("pt-BR")}`;
  const res = await fetch(`${BASE}/api/crm/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, Cookie: `qmax_crm_session=${session(testId)}` },
    body: JSON.stringify({ type: "IMPROVEMENT", area, title, description: "Pedido criado pelo scripts/check-request-notification.mjs" }),
  });
  assert.equal(res.status, 200, `POST /api/crm/request: ${res.status} ${await res.clone().text()}`);
  const { id } = await res.json();

  const notified = await db.query("SELECT memberId, message FROM CrmNotification WHERE requestId = ?", [id]);
  const ids = new Set(notified.map((n) => n.memberId));
  for (const m of expected) assert.ok(ids.has(m.id), `${m.name} was not notified`);
  assert.ok(!ids.has(testId), "the author must not be notified");
  console.log(`ok: "${title}" notified ${notified.length} member(s): ${notified[0]?.message ?? "-"}`);
} finally {
  await db.query("DELETE FROM TeamMember WHERE id = ?", [testId]); // the request keeps authorId = null
  await db.end();
}
