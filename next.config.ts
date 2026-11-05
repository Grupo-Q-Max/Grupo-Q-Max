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
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.grupoqmax.com.br",
          },
        ],
        destination: "https://grupoqmax.com.br/:path*",
        permanent: true,
      },
      { source: "/crm/access", destination: "/crm/settings/access", permanent: true },
      { source: "/eventos", destination: "/finora-experience", permanent: false },
      { source: "/eventos/:path*", destination: "/finora-experience/:path*", permanent: false },
      { source: "/proposta", destination: "/proposta/login.html", permanent: false },
      { source: "/proposta/", destination: "/proposta/login.html", permanent: false },
      { source: "/qmax-quiz", destination: "/quiz", permanent: false },
      { source: "/qmax-quiz/:path*", destination: "/quiz/:path*", permanent: false },
    ];
  },

  async rewrites() {
    const eventosUrl = process.env.EVENTOS_URL || "http://127.0.0.1:3001";
    const propostaUrl = (process.env.PROPOSTA_URL || "http://127.0.0.1:3005").replace(/\/$/, "");
    const quizUrl = (process.env.QUIZ_URL || "http://127.0.0.1:8003").replace(/\/$/, "");
    return [
      {
        source: "/team/:filename*",
        destination: "/api/files/:filename*",
      
      },
      // Sistema Q-Max Quiz
      {
        source: "/qmax-quiz",
        destination: `${quizUrl}/index.php`,
      },
      {
        source: "/qmax-quiz/",
        destination: `${quizUrl}/index.php`,
      },
      {
        source: "/qmax-quiz/:path*",
        destination: `${quizUrl}/:path*`,
      },
      {
        source: "/quiz",
        destination: `${quizUrl}/index.php`,
      },
      {
        source: "/quiz/",
        destination: `${quizUrl}/index.php`,
      },
      {
        source: "/quiz/:path*",
        destination: `${quizUrl}/:path*`,
      },
      // Sistema de Propostas (Finora / Q-Max)
      {
        source: "/proposta/:path*",
        destination: `${propostaUrl}/proposta/:path*`,
      },
      // Fallback para assets de propostas solicitados sem prefixo /proposta
      {
        source: "/styles.css",
        destination: `${propostaUrl}/proposta/styles.css`,
      },
      {
        source: "/css/:filename*",
        destination: `${propostaUrl}/proposta/css/:filename*`,
      },
      {
        source: "/js/:filename*",
        destination: `${propostaUrl}/proposta/js/:filename*`,
      },
      {
        source: "/script.js",
        destination: `${propostaUrl}/proposta/script.js`,
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
        destination: `${propostaUrl}/api/notifications/stream`,
      },
      {
        source: "/finora-experience",
        destination: `${eventosUrl}/finora-experience`,
      },
      {
        source: "/finora-experience/:path*",
        destination: `${eventosUrl}/finora-experience/:path*`,
      },
    ];
  },
};

export default nextConfig;
