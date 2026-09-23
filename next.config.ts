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

  async rewrites() {
    return [
      {
        source: "/team/:filename*",
        destination: "/api/files/:filename*",
      },
    ];
  },
};

export default nextConfig;