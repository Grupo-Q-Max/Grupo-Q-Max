import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAdminToken } from "@/lib/settings";
import { ADMIN_COOKIE } from "@/lib/auth";
import { imageExtension } from "@/lib/storage";

const PUBLIC_BRANDS_DIR = path.join(process.cwd(), "public", "brands");
const UPLOAD_BRANDS_DIR = path.join(process.cwd(), "data", "uploads", "brands");

export async function POST(req: NextRequest) {
  if (!isAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const filename = formData.get("filename");

    if (!(file instanceof File) || typeof filename !== "string") {
      return NextResponse.json({ error: "Missing file or filename" }, { status: 400 });
    }

    if (!imageExtension(file)) {
      return NextResponse.json({ error: "Only PNG, JPG or WebP images up to 5 MB" }, { status: 400 });
    }

    // Files land in public/: plain names with an image extension only (no .html/.svg)
    const safeName = path.basename(filename);
    if (!/^[\w-]+\.(png|jpe?g|webp)$/i.test(safeName)) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    // Save to both public/brands (dev/build static) and data/uploads/brands (runtime)
    if (!fs.existsSync(PUBLIC_BRANDS_DIR)) {
      fs.mkdirSync(PUBLIC_BRANDS_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(PUBLIC_BRANDS_DIR, safeName), buffer);

    if (!fs.existsSync(UPLOAD_BRANDS_DIR)) {
      fs.mkdirSync(UPLOAD_BRANDS_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(UPLOAD_BRANDS_DIR, safeName), buffer);

    return NextResponse.json({ path: `/brands/${safeName}`, ok: true });
  } catch (err) {
    console.error("Error saving brand logo:", err);
    return NextResponse.json({ error: "Failed to save logo" }, { status: 500 });
  }
}
