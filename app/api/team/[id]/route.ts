import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getTeamJsonPath, getUploadsDir } from "@/lib/storage";

function readTeam() {
  const dataPath = getTeamJsonPath();
  if (!fs.existsSync(dataPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch {
    return [];
  }
}

function writeTeam(data: unknown[]) {
  const dataPath = getTeamJsonPath();
  const dir = path.dirname(dataPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), "utf8");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const team = readTeam();
  const filtered = team.filter((m: { id: string }) => m.id !== id);

  // Delete the image file if it exists
  const member = team.find((m: { id: string }) => m.id === id);
  if (member?.image) {
    const filename = path.basename(member.image.split("?")[0]);
    const imgPath = path.join(getUploadsDir(), filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    const legacyPath = path.join(process.cwd(), "public", "team", filename);
    if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath);
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
