// Admin (/admin) cookie: signed token bound to the current admin password. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AUTH_SECRET = "test-secret";
const { createAdminToken, readAdminToken, createAdminResetToken, readAdminResetToken, samePassword } = await import(
  "../lib/auth.ts"
);

test("reset link works only until the password changes, and never as an admin cookie", () => {
  const link = createAdminResetToken("");
  assert.equal(readAdminResetToken(link, ""), true); // no password yet: creating the first one
  assert.equal(readAdminResetToken(link, "nova-senha-1"), false); // used: the password changed
  assert.equal(readAdminToken(link, ""), false);
  assert.equal(readAdminResetToken(createAdminToken("senha-forte-1"), "senha-forte-1"), false);
});

test("admin token works only with the password it was issued for", () => {
  const token = createAdminToken("senha-forte-1");
  assert.equal(readAdminToken(token, "senha-forte-1"), true);
  assert.equal(readAdminToken(token, "outra-senha"), false);
  assert.equal(readAdminToken("senha-forte-1", "senha-forte-1"), false); // the old cookie held the password itself
  assert.equal(readAdminToken(undefined, "senha-forte-1"), false);
  assert.equal(readAdminToken(token.replace(/.$/, "x"), "senha-forte-1"), false);
});

test("samePassword never matches an empty expected password", () => {
  assert.equal(samePassword("abc", "abc"), true);
  assert.equal(samePassword("abc", "abd"), false);
  assert.equal(samePassword("", ""), false);
  assert.equal(samePassword(undefined, "abc"), false);
});
