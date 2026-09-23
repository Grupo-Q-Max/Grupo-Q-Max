import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const memberId = formData.get("memberId") as string | null;

  if (!file || !memberId) {
    return NextResponse.json({ error: "Missing file or memberId" }, { status: 400 });
  }

  // Validate image type
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `team-${memberId}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "team");

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, buffer);

  const publicPath = `/team/${fileName}`;
  return NextResponse.json({ path: publicPath });
}
