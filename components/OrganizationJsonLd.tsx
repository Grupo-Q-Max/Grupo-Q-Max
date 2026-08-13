export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],

    name: "Grupo Q-Max",

    url: "https://www.grupoqmax.com.br",

    logo: "https://www.grupoqmax.com.br/icon.png",

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

    knowsAbout: [
      "Auditoria",
      "Contabilidade",
      "Gestão de Pessoas",
      "Tecnologia",
      "Coworking",
      "Documentação Digital",
      "Inteligência Financeira",
      "Soluções Empresariais",
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