import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { findUploadedFile } from "@/lib/storage";

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
    const safeName = path.basename(decodeURIComponent(filename));
    const resolvedPath = findUploadedFile(safeName);
    if (!resolvedPath) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await fs.promises.readFile(/*turbopackIgnore: true*/ resolvedPath);
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
        "X-Content-Type-Options": "nosniff",
        // An SVG opened directly could run script on this origin; the sandbox blocks it
        "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (err) {
    console.error("Error serving file:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
