import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "@/lib/storage";

// Serve uploaded files from persistent storage with fallback to public/team/ and public/brands/
// This works reliably in dev, local build, and Azure App Service (Next.js standalone)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    if (!filename) {
      return NextResponse.json({ error: "Missing filename" }, { status: 400 });
    }

    // Security: prevent path traversal
    const safeName = path.basename(filename);

    // Search locations in priority order:
    // 1. Persistent cloud uploads: HOME/site/qmax_data/uploads (survives any deploy)
    // 2. Local/build data/uploads/[filename]
    // 3. public/team/[filename] (legacy folder)
    // 4. Brands directories
    const persistentUploads = getUploadsDir();
    const searchPaths = [
      path.join(persistentUploads, safeName),
      path.join(process.cwd(), "data", "uploads", safeName),
      path.join(process.cwd(), "public", "team", safeName),
      path.join(persistentUploads, "brands", safeName),
      path.join(process.cwd(), "data", "uploads", "brands", safeName),
      path.join(process.cwd(), "public", "brands", safeName),
    ];

    let resolvedPath: string | null = null;
    for (const p of searchPaths) {
      if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
        resolvedPath = p;
        break;
      }
    }

    if (!resolvedPath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = fs.readFileSync(/*turbopackIgnore: true*/ resolvedPath);
    const ext = safeName.split(".").pop()?.toLowerCase() || "jpg";

    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
    };

    const contentType = mimeMap[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Error serving file:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
