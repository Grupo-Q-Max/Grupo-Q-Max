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
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          // camera=(self): the Finora Experience admin (rewritten under this origin) scans with the camera
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
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
    const propostaUrl = (process.env.PROPOSTA_URL || "http://127.0.0.1:3005").replace(/\/$/, "");
    const fechamentoUrl = (process.env.FECHAMENTO_URL || "https://grupoqmax.com.br/controle_fechamento").replace(/\/$/, "");
    return [
      {
        source: "/team/:filename*",
        destination: "/api/files/:filename*",
      
      },
      // Sistema de Propostas (Finora / Q-Max)
      {
        source: "/proposta",
        destination: `${propostaUrl}/proposta`,
      },
      {
        source: "/proposta/:path*",
        destination: `${propostaUrl}/proposta/:path*`,
      },
      {
        source: "/api/propostas/:path*",
        destination: `${propostaUrl}/api/propostas/:path*`,
      },
      {
        source: "/api/propostas",
        destination: `${propostaUrl}/api/propostas`,
      },
      {
        source: "/api/solicitacoes/:path*",
        destination: `${propostaUrl}/api/solicitacoes/:path*`,
      },
      {
        source: "/api/solicitacoes",
        destination: `${propostaUrl}/api/solicitacoes`,
      },
      {
        source: "/api/regras/:path*",
        destination: `${propostaUrl}/api/regras/:path*`,
      },
      {
        source: "/api/regras",
        destination: `${propostaUrl}/api/regras`,
      },
      {
        source: "/api/funis/:path*",
        destination: `${propostaUrl}/api/funis/:path*`,
      },
      {
        source: "/api/funis",
        destination: `${propostaUrl}/api/funis`,
      },
      {
        source: "/api/automacoes/:path*",
        destination: `${propostaUrl}/api/automacoes/:path*`,
      },
      {
        source: "/api/automacoes",
        destination: `${propostaUrl}/api/automacoes`,
      },
      {
        source: "/api/prospeccao/:path*",
        destination: `${propostaUrl}/api/prospeccao/:path*`,
      },
      {
        source: "/api/prospeccao",
        destination: `${propostaUrl}/api/prospeccao`,
      },
      {
        source: "/api/auth/login",
        destination: `${propostaUrl}/api/auth/login`,
      },
      {
        source: "/api/usuarios/:path*",
        destination: `${propostaUrl}/api/usuarios/:path*`,
      },
      {
        source: "/api/notifications/stream",
        destination: `${propostaUrl}/api/notifications/stream`,},
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
      {
        source: "/controle_fechamento",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/controle_fechamento/",
        destination: `${fechamentoUrl}/index.php`,
      },
      {
        source: "/controle_fechamento/:path*",
        destination: `${fechamentoUrl}/:path*`,
      },
      {
        source: "/assets/:path*",
        destination: `${fechamentoUrl}/assets/:path*`,
      },
      {
        source: "/partes/:path*",
        destination: `${fechamentoUrl}/partes/:path*`,
      },
      {
        source: "/Documentos/:path*",
        destination: `${fechamentoUrl}/Documentos/:path*`,
      },
      {
        source: "/scripts_globais.js",
        destination: `${fechamentoUrl}/scripts_globais.js`,
      },
      {
        source: "/password_modal.js",
        destination: `${fechamentoUrl}/password_modal.js`,
      },
      {
        source: "/notifications.js",
        destination: `${fechamentoUrl}/notifications.js`,
      },
      {
        source: "/:file.php",
        destination: `${fechamentoUrl}/:file.php`,
      },
    ];
  },
};

export default nextConfig;