export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Grupo Q-Max",
    url: "https://www.grupoqmax.com.br",
    logo: "https://www.grupoqmax.com.br/icon.png",
    description:
      "Ecossistema empresarial que conecta auditoria, contabilidade, talentos, tecnologia e soluções digitais.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "R. Frei Gaspar, 941",
      addressLocality: "São Bernardo do Campo",
      addressRegion: "SP",
      addressCountry: "BR"
    }
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