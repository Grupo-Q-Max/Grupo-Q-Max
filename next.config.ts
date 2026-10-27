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

  // CSP left out on purpose: GA4, MSAL popup and the Google Maps embed need a tuned policy
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No includeSubDomains: other *.qmaxbrasil.com.br hosts are not known to be HTTPS-only
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // camera=(self): the Finora Experience admin (rewritten under this origin) scans with the camera
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/crm/access", destination: "/crm/settings/access", permanent: true },
      { source: "/eventos", destination: "/finora-experience", permanent: false },
      { source: "/eventos/:path*", destination: "/finora-experience/:path*", permanent: false },
    ];
  },

  async rewrites() {
    const eventosUrl = process.env.EVENTOS_URL || "http://127.0.0.1:3001";
    const fechamentoUrl = (process.env.FECHAMENTO_URL || "https://grupoqmax.com.br/controle_fechamento").replace(/\/$/, "");
    return [
      {
        source: "/team/:filename*",
        destination: "/api/files/:filename*",
      },
      {
        source: "/finora-experience",
        destination: `${eventosUrl}/finora-experience`,
      },
      {
        source: "/finora-experience/:path*",
        destination: `${eventosUrl}/finora-experience/:path*`,
      },
      {
        source: "/fechamento",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/fechamento/",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/fechamento/:path*",
        destination: `${fechamentoUrl}/:path*`,
      },
      {
        source: "/controle-fechamento",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/controle-fechamento/",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/controle-fechamento/:path*",
        destination: `${fechamentoUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;