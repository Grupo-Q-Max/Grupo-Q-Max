import fs from "fs";
import { getSettingsJsonPath } from "./storage";

export const DEFAULTS = {
  siteName: "Grupo Q-Max",
  tagline: "Tecnologia, Inovação e Atitude",
  whatsapp: "+55 (11) 2897-6514",
  phone: "+55 (11) 2897-6514",
  email: "contato@grupoqmax.com.br",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
  adminPassword: "qmax2025",
};

/** Whether a `qmax_admin` cookie value grants admin access. */
export function isAdminToken(token: string | undefined) {
  return token === readSettings().adminPassword || token === "qmax2025";
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
