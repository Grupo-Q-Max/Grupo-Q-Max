import fs from "fs";
import path from "path";
import { createHash, timingSafeEqual } from "crypto";
import { getSettingsJsonPath } from "./storage";
import { readAdminToken } from "./auth";

export const DEFAULTS = {
  siteName: "Grupo Q-Max",
  tagline: "Tecnologia, Inovação e Atitude",
  whatsapp: "+55 (11) 2897-6514",
  phone: "+55 (11) 2897-6514",
  email: "contato@grupoqmax.com.br",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
  adminPassword: "",
};

// The old built-in default is public (git history): a settings.json still holding it must not unlock the admin
const LEAKED_PASSWORDS = new Set(["qmax2025"]);

/** Admin password: the one saved from /admin, else env ADMIN_PASSWORD, else "" (admin locked). */
export function adminPassword(): string {
  const saved = String(readSettings().adminPassword ?? "");
  if (saved && !LEAKED_PASSWORDS.has(saved)) return saved;
  return process.env.ADMIN_PASSWORD ?? "";
}

// TEMPORARY: lets the admin in before ADMIN_EMAILS is set. Only the SHA-256 is here, never the password. Remove soon.
const TEMP_ADMIN_PASSWORD_SHA256 = "41bac7845d0aa3adc23bb450f20d39f0a27bf9a68d05e9efed4ec352d0adb5d5";

/** Whether `input` is the temporary admin password. */
export const isTempAdminPassword = (input: unknown) =>
  typeof input === "string" &&
  timingSafeEqual(createHash("sha256").update(input).digest(), Buffer.from(TEMP_ADMIN_PASSWORD_SHA256, "hex"));

/** Key the admin cookie is signed with: the admin password, or (none set) the temporary one's hash. */
export const adminCookieKey = () => adminPassword() || TEMP_ADMIN_PASSWORD_SHA256;

/** Whether a `qmax_admin` cookie value grants admin access. */
export function isAdminToken(token: string | undefined) {
  return readAdminToken(token, adminCookieKey());
}

/** Settings safe to send to a browser: never the admin password, not even to the admin. */
export function withoutPassword(settings: ReturnType<typeof readSettings>) {
  const { adminPassword: _password, ...rest } = settings;
  return rest;
}

/** E-mails that may get a link to set the /admin password (env ADMIN_EMAILS, comma-separated). */
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function writeSettings(data: object) {
  const p = getSettingsJsonPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export function readSettings() {
  const p = getSettingsJsonPath();
  if (!fs.existsSync(p)) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch {
    return DEFAULTS;
  }
}
