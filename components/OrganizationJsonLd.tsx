export function OrganizationJsonLd() {
  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grupoqmax.com.br").replace(/\/+$/, "");

  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],

    name: "Grupo Q-Max",

    url: baseUrl,

    logo: `${baseUrl}/icon.png`,

    description:
      "Ecossistema empresarial que conecta auditoria, contabilidade, talentos, tecnologia, estrutura e soluções digitais para apoiar empresas em diferentes áreas de gestão e desenvolvimento.",

    telephone: "+55 11 2897-6514",

    address: {
      "@type": "PostalAddress",
      streetAddress: "R. Frei Gaspar, 941",
      addressLocality: "São Bernardo do Campo",
      addressRegion: "SP",
      addressCountry: "BR",
    },

    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+55 11 2897-6514",
      contactType: "customer service",
      areaServed: "BR",
      availableLanguage: ["Portuguese"],
    },

    areaServed: {
      "@type": "Country",
      name: "Brazil",
    },

    sameAs: [
      "https://www.linkedin.com/company/grupoqmax",
      "https://www.instagram.com/grupoqmax",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
