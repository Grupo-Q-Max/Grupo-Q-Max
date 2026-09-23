import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettingsJsonPath } from "@/lib/storage";

const DEFAULTS = {
  siteName: "Grupo Q-Max",
  tagline: "Tecnologia, Inovação e Atitude",
  whatsapp: "+55 (11) 2897-6514",
  phone: "+55 (11) 2897-6514",
  email: "contato@grupoqmax.com.br",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
  adminPassword: "qmax2025",
};

function read() {
  const p = getSettingsJsonPath();
  if (!fs.existsSync(p)) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch {
    return DEFAULTS;
  }
}

function write(data: object) {
  const p = getSettingsJsonPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(read());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const current = read();
  const updated = { ...current, ...body };
  write(updated);
  return NextResponse.json(updated);
}
