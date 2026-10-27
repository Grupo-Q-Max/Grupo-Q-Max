import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
      ],
    },
    sitemap: "https://qmaxbrasil.com.br/sitemap.xml",
  };
}
