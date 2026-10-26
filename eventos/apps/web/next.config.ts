import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  basePath: '/finora-experience',
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/finora-experience',
        basePath: false,
        permanent: false,
      },
      {
        source: '/admin',
        destination: '/finora-experience/admin',
        basePath: false,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:3334/api/v1/:path*'
      }
    ];
  },
};

export default nextConfig;
