import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

const DEFAULTS = {
  siteName: "Grupo Q-Max",
  tagline: "Tecnologia, Inovação e Atitude",
  whatsapp: "+55 (11) 91295-7356",
  phone: "+55 (11) 2897-6514",
  email: "contato@grupoqmax.com.br",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
  adminPassword: "qmax2025",
};

function read() {
  if (!fs.existsSync(SETTINGS_PATH)) return DEFAULTS;
  return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
}

function write(data: object) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), "utf8");
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
