import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  distDir: ".qmax-next",

  outputFileTracingRoot: path.join(__dirname),

  turbopack: {
    root: path.join(__dirname),
  },

  images: {
    formats: ["image/avif", "image/webp"],
  },

  async redirects() {
    // Access levels moved under settings
    return [{ source: "/crm/access", destination: "/crm/settings/access", permanent: true }];
  },

  async rewrites() {
    const eventosUrl = process.env.EVENTOS_URL || "http://127.0.0.1:3001";
    return [
      {
        source: "/team/:filename*",
        destination: "/api/files/:filename*",
      },
      {
        source: "/finora-experience/:path*",
        destination: `${eventosUrl}/finora-experience/:path*`,
      },
      {
        source: "/eventos/:path*",
        destination: `${eventosUrl}/finora-experience/:path*`,
      },
    ];
  },
};

export default nextConfig;