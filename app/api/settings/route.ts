import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSettingsJsonPath } from "@/lib/storage";
import { readSettings } from "@/lib/settings";

function write(data: object) {
  const p = getSettingsJsonPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const current = readSettings();
  const updated = { ...current, ...body };
  write(updated);
  return NextResponse.json(updated);
}
