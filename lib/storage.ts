import fs from "fs";
import path from "path";

// Returns the true persistent storage directory.
// In Azure App Service:
// WEBSITE_SITE_NAME is defined, and HOME points to persistent storage (/home or D:\home).
// The website runs inside HOME/site/wwwroot.
// By placing our runtime data in HOME/site/qmax_data, it is stored in persistent cloud storage
// and is located OUTSIDE wwwroot, so NO future deployment, git push or zip deploy can ever delete it.
export function getDataDir(): string {
  const isAzure = Boolean(
    process.env.WEBSITE_SITE_NAME ||
    process.env.REGION_NAME ||
    (process.env.HOME && fs.existsSync(path.join(process.env.HOME, "site")))
  );

  if (isAzure && process.env.HOME) {
    const persistentDir = path.join(process.env.HOME, "site", "qmax_data");
    ensureInitialized(persistentDir);
    return persistentDir;
  }

  // Local development fallback
  const localDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

export function getUploadsDir(): string {
  const dir = path.join(getDataDir(), "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Path of a file served by /api/files: persistent uploads first, then the packaged fallbacks
 * (public/team, public/brands). Case-insensitive; null when not found.
 */
export function findUploadedFile(fileName: string): string | null {
  const lower = path.basename(fileName).toLowerCase();
  const uploads = getUploadsDir();
  const dirs = [
    uploads,
    path.join(process.cwd(), "data", "uploads"),
    path.join(process.cwd(), "public", "team"),
    path.join(uploads, "brands"),
    path.join(process.cwd(), "data", "uploads", "brands"),
    path.join(process.cwd(), "public", "brands"),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) continue;
    const match = fs.readdirSync(/*turbopackIgnore: true*/ dir).find((f) => f.toLowerCase() === lower);
    if (match) return path.join(dir, match);
  }
  return null;
}

export function getSettingsJsonPath(): string {
  return path.join(getDataDir(), "settings.json");
}

let initialized = false;

function ensureInitialized(persistentDir: string) {
  if (initialized) return;
  initialized = true;

  try {
    if (!fs.existsSync(persistentDir)) {
      fs.mkdirSync(persistentDir, { recursive: true });
    }
    const persistentUploads = path.join(persistentDir, "uploads");
    if (!fs.existsSync(persistentUploads)) {
      fs.mkdirSync(persistentUploads, { recursive: true });
    }

    // Seed initial team uploads from package
    const seedDirs = [
      path.join(process.cwd(), "data", "uploads"),
      path.join(process.cwd(), "public", "team"),
    ];
    for (const srcDir of seedDirs) {
      if (fs.existsSync(/*turbopackIgnore: true*/ srcDir)) {
        const files = fs.readdirSync(/*turbopackIgnore: true*/ srcDir);
        for (const file of files) {
          const srcFile = path.join(/*turbopackIgnore: true*/ srcDir, file);
          const destFile = path.join(persistentUploads, file);
          if (fs.statSync(/*turbopackIgnore: true*/ srcFile).isFile() && !fs.existsSync(destFile)) {
            fs.copyFileSync(srcFile, destFile);
          }
        }
      }
    }
  } catch (err) {
    console.error("Storage initialization error:", err);
  }
}
