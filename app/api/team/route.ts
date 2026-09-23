import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "team.json");

function readTeam() {
  if (!fs.existsSync(DATA_PATH)) return [];
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeTeam(data: unknown[]) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

export async function GET() {
  const team = readTeam();
  return NextResponse.json(team);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const team = readTeam();
  const newMember = {
    id: Date.now().toString(),
    name: body.name || "Novo Membro",
    role: body.role || "Cargo",
    sector: body.sector || "Setor",
    image: body.image || null,
    order: team.length,
  };
  team.push(newMember);
  writeTeam(team);
  return NextResponse.json(newMember, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  // Reorder: receives full ordered array of {id}
  const body = await req.json();
  const team = readTeam();
  const reordered = body.order.map((id: string, idx: number) => {
    const member = team.find((m: { id: string }) => m.id === id);
    return { ...member, order: idx };
  });
  writeTeam(reordered);
  return NextResponse.json(reordered);
}
