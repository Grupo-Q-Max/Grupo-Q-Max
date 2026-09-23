import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const memberId = formData.get("memberId") as string | null;

  if (!file || !memberId) {
    return NextResponse.json({ error: "Missing file or memberId" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only images allowed" }, { status: 400 });
  }

  const uploadDir = getUploadsDir();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `team-${memberId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  // Return the API route path — not a /public/ path
  return NextResponse.json({ path: `/api/files/${fileName}` });
}
