export type BrandAsset = {
  src: string;
  alt: string;
  fit?: "contain" | "cover";
};

export const companies = [
  {
    id: "audit",
    name: "Q-Max Auditoria",
    short: "Auditoria",
    accent: "#ff2f91",
    eyebrow: "Governança & confiança",
    description: "Serviços especializados de auditoria para garantir conformidade e transparência nos processos.",
    href: "/auditoria",
    logo: null as BrandAsset | null,
  },
  {
    id: "contabil",
    name: "Q-Max Contábil",
    short: "Contábil",
    accent: "#35e1d0",
    eyebrow: "Contabilidade moderna",
    description: "Gestão contábil e fiscal completa, focada na otimização de resultados e compliance.",
    href: "/contabil",
    logo: { src: "/brands/qmax-contabil-dark.png", alt: "Q-Max Contábil" } as BrandAsset,
    logoSurface: "light",
  },
  {
    id: "talents",
    name: "Q-Max Talents",
    short: "Talents",
    accent: "#b26bff",
    eyebrow: "Pessoas & performance",
    description: "Soluções em RH, do recrutamento e seleção ao desenvolvimento de talentos.",
    href: "/talents",
    logo: { src: "/brands/qmax-talents.png", alt: "Q-Max Talents" } as BrandAsset,
    logoSurface: "dark",
  },
  {
    id: "technology",
    name: "Q-Max Technology",
    short: "Technology",
    accent: "#5077ff",
    eyebrow: "Digital & inovação",
    description: "Estratégias digitais, programa de indicação e desenvolvimento de ferramentas para acelerar o seu negócio.",
    href: "/technology",
    logo: { src: "/brands/qmax-technology-white.png", alt: "Q-Max Technology" } as BrandAsset,
    logoSurface: "dark",
  },
  {
    id: "lagerhaus",
    name: "Lagerhaus",
    short: "Lagerhaus",
    accent: "#d8eb34",
    eyebrow: "Estrutura para negócios",
    description: "Endereço fiscal, comercial, armazenagem/estocagem e espaços de coworking modernos para o seu negócio.",
    href: "/lagerhaus",
    logo: null as BrandAsset | null,
  },
] as const;

export const products = [
  {
    id: "qxback",
    name: "QXBACK",
    accent: "#79ef2d",
    kicker: "Indicação & bonificação",
    description: "Programa de bonificação por indicação: conectando pessoas e negócios, convertendo relacionamento em receita.",
    features: ["Cashback por serviços contratados", "Bônus por propostas enviadas", "Gestão de indicações", "Ganhos em tempo real", "Cancelar e estornar resgate"],
    logo: { src: "/brands/qxback.png", alt: "QXBACK" } as BrandAsset,
  },
  {
    id: "qxsign",
    name: "QXSIGN",
    accent: "#16e1d4",
    kicker: "Identidade digital",
    description: "Atendimento personalizado para certificados digitais e documentação digital.",
    features: ["Atendimento personalizado", "Documentação digital", "Certificados digitais"],
    logo: null as BrandAsset | null,
  },
  {
    id: "finora",
    name: "FINORA",
    accent: "#b464ff",
    kicker: "Gestão odontológica",
    description: "Solução voltada ao planejamento tributário, gestão contábil e financeira e regularização documental para clínicas odontológicas, promovendo liberdade profissional.",
    features: ["Planejamento tributário", "Gestão contábil e financeira", "Regularização documental", "Liberdade profissional"],
    logo: null as BrandAsset | null,
  },
] as const;

export const values = [
  "Colaboração e Conexão",
  "Sustentabilidade e Responsabilidade",
  "Inovação com Propósito",
  "Ética e Transparência",
] as const;

export const contact = {
  email: "contato@grupoqmax.com.br",
  phone: "+55 (11) 2897-6514",
  whatsapp: "+55 (11) 2897-6514",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
} as const;

/*
 * Data controller details used by the privacy policy, terms, cookie policy and footers.
 * Fill in each legalName and cnpj: the policy must identify the controller (LGPD Art. 9, II).
 * Bump privacyVersion whenever the privacy policy changes in substance: the cookie banner asks
 * again and new leads record the version they accepted.
 */
export const legal = {
  groupName: "Grupo Q-Max",
  companies: [
    { brand: "Q-Max Auditoria e Consultoria", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
    { brand: "Q-Max Contábil", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
    { brand: "Q-Max Talents", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
    { brand: "Q-Max Technology", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
    { brand: "FINORA", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
    { brand: "Lagerhaus Coworking & Negócios", legalName: "[RAZÃO SOCIAL]", cnpj: "[CNPJ]" },
  ],
  /** Company shown in the footer as the main controller. */
  mainCompanyIndex: 0,
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, Centro, São Bernardo do Campo - SP, CEP 09710-180",
  dpoName: "Encarregado de Proteção de Dados (DPO)",
  dpoEmail: "dpo@grupoqmax.com.br",
  privacyVersion: "2026-11-17",
  lastUpdated: "17 de novembro de 2026",
  responseDays: 15,
  retention: {
    leadsMonths: 24,
    pageVisitsMonths: 6,
  },
} as const;
