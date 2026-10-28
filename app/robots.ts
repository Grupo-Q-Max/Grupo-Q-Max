import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grupoqmax.com.br").replace(/\/+$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Internal tools and endpoints: nothing to index there
      disallow: [
        "/crm",
        "/admin",
        "/api/",
        "/login",
        "/auth/",
        "/integracao",
        "/fechamento",
        "/controle-fechamento",
        "/controle_fechamento",
        "/proposta",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
