import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: '/finora-experience',
  compress: true,
  poweredByHeader: false,
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
        destination: 'http://127.0.0.1:3334/api/v1/:path*'
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|png|webp|ico|woff2)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
