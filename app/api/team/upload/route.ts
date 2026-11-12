import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUploadsDir, imageExtension } from "@/lib/storage";
import { siteAdminDenied } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const denied = siteAdminDenied(req);
  if (denied) return denied;
  const formData = await req.formData();
  const file = formData.get("file");
  const memberId = formData.get("memberId");

  // memberId goes into the file name: only id characters, so it can't escape the uploads folder
  if (!(file instanceof File) || typeof memberId !== "string" || !/^[\w-]{1,64}$/.test(memberId)) {
    return NextResponse.json({ error: "Missing file or memberId" }, { status: 400 });
  }

  const ext = imageExtension(file);
  if (!ext) {
    return NextResponse.json({ error: "Only PNG, JPG or WebP images up to 5 MB" }, { status: 400 });
  }

  const uploadDir = getUploadsDir();
  const fileName = `team-${memberId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  // Return the API route path — not a /public/ path
  return NextResponse.json({ path: `/api/files/${fileName}` });
}
