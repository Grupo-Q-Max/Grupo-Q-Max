import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "team.json");

function readTeam() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeTeam(data: unknown[]) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const team = readTeam();
  const filtered = team.filter((m: { id: string }) => m.id !== id);

  // Delete the image file if it exists (stored in data/uploads/)
  const member = team.find((m: { id: string }) => m.id === id);
  if (member?.image) {
    // Support both old /team/ paths and new /api/files/ paths
    const filename = path.basename(member.image.split("?")[0]);
    const imgPath = path.join(process.cwd(), "data", "uploads", filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  writeTeam(filtered);
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const team = readTeam();
  const idx = team.findIndex((m: { id: string }) => m.id === id);
  if (idx === -1) return NextResponse.json({ error: "not found" }, { status: 404 });
  team[idx] = { ...team[idx], ...body };
  writeTeam(team);
  return NextResponse.json(team[idx]);
}
