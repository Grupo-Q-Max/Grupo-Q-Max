export function OrganizationJsonLd() {
  const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://grupoqmax.com.br").replace(/\/+$/, "");

  const organizationData = {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    name: "Grupo Q-Max",
    url: baseUrl,
    logo: `${baseUrl}/icon.png`,
    description:
      "Ecossistema empresarial que conecta auditoria, contabilidade, talentos, tecnologia, estrutura e soluções digitais para apoiar empresas em diferentes áreas de gestão e desenvolvimento.",
    telephone: "+55 11 2897-6514",
    email: "contato@grupoqmax.com.br",
    address: {
      "@type": "PostalAddress",
      streetAddress: "R. Frei Gaspar, 941",
      addressLocality: "São Bernardo do Campo",
      addressRegion: "SP",
      postalCode: "09720-440",
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
    department: [
      {
        "@type": "ProfessionalService",
        name: "Q-Max Auditoria",
        url: `${baseUrl}/auditoria`,
        description: "Auditoria contábil, tributária, de processos e demonstrações financeiras com independência técnica e rigor analítico.",
        telephone: "+55 11 2897-6514",
      },
      {
        "@type": "ProfessionalService",
        name: "Q-Max Contábil",
        url: `${baseUrl}/contabil`,
        description: "Contabilidade estratégica, gestão fiscal, folha de pagamento e BPO financeiro integrado para negócios em expansão.",
        telephone: "+55 11 2897-6514",
      },
      {
        "@type": "ProfessionalService",
        name: "Q-Max Talents",
        url: `${baseUrl}/talents`,
        description: "Executive search, recrutamento especializado, hunting executivo e consultoria em gestão de pessoas e alta performance.",
        telephone: "+55 11 2897-6514",
      },
      {
        "@type": "ProfessionalService",
        name: "Q-Max Technology",
        url: `${baseUrl}/technology`,
        description: "Desenvolvimento de software corporativo sob medida, automação de processos, integração de APIs e transformação digital.",
        telephone: "+55 11 2897-6514",
      },
      {
        "@type": "ProfessionalService",
        name: "Lagerhaus",
        url: `${baseUrl}/lagerhaus`,
        description: "Estrutura moderna, galpões logísticos e locação corporativa de alto padrão para operações empresariais robustas.",
        telephone: "+55 11 2897-6514",
      },
    ],
    sameAs: [
      "https://www.linkedin.com/company/grupoqmax",
      "https://www.instagram.com/grupoqmax",
    ],
  };

  const webSiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Grupo Q-Max",
    url: baseUrl,
    description: "Tecnologia, Inovação e Atitude em Auditoria, Contabilidade, Talentos e Tecnologia.",
    publisher: {
      "@type": "Organization",
      name: "Grupo Q-Max",
      logo: `${baseUrl}/icon.png`,
    },
    inLanguage: "pt-BR",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationData),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webSiteData),
        }}
      />
    </>
  );
}
