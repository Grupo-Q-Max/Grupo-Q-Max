import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BRANDS_DIR = path.join(process.cwd(), "public", "brands");

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const filename = formData.get("filename") as string | null;

  if (!file || !filename) {
    return NextResponse.json({ error: "Missing file or filename" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(BRANDS_DIR, filename);
  fs.writeFileSync(filePath, buffer);

  return NextResponse.json({ path: `/brands/${filename}`, ok: true });
}
