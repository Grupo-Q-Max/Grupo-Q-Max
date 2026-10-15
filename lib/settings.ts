import fs from "fs";
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

/** Whether a `qmax_admin` cookie value grants admin access. */
export function isAdminToken(token: string | undefined) {
  const password = adminPassword();
  return !!password && readAdminToken(token, password);
}

/** Settings safe to send to a browser: never the admin password, not even to the admin. */
export function withoutPassword(settings: ReturnType<typeof readSettings>) {
  const { adminPassword: _password, ...rest } = settings;
  return rest;
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
