import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Upload dir is inside `data/` — NOT inside `public/`.
// This ensures files survive in Next.js standalone (output: "standalone") production builds,
// where runtime writes to public/ are NOT served as static files.
// Files are served via /api/files/[filename] instead.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

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

  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `team-${memberId}-${Date.now()}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  // Return the API route path — not a /public/ path
  return NextResponse.json({ path: `/api/files/${fileName}` });
}
