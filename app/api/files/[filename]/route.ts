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

    // Decode and prevent path traversal
    const decodedName = decodeURIComponent(filename);
    const safeName = path.basename(decodedName);
    const lowerSafeName = safeName.toLowerCase();

    // Search locations in priority order:
    const persistentUploads = getUploadsDir();
    const searchDirs = [
      persistentUploads,
      path.join(process.cwd(), "data", "uploads"),
      path.join(process.cwd(), "public", "team"),
      path.join(persistentUploads, "brands"),
      path.join(process.cwd(), "data", "uploads", "brands"),
      path.join(process.cwd(), "public", "brands"),
    ];

    let resolvedPath: string | null = null;
    let actualFilename = safeName;
    for (const dir of searchDirs) {
      if (fs.existsSync(/*turbopackIgnore: true*/ dir)) {
        const files = fs.readdirSync(/*turbopackIgnore: true*/ dir);
        const match = files.find(f => f.toLowerCase() === lowerSafeName);
        if (match) {
          resolvedPath = path.join(dir, match);
          actualFilename = match;
          break;
        }
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
