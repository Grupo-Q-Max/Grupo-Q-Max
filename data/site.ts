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
    href: "https://www.grupoqmax.com.br/",
    logo: null as BrandAsset | null,
  },
  {
    id: "contabil",
    name: "Q-Max Contábil",
    short: "Contábil",
    accent: "#35e1d0",
    eyebrow: "Contabilidade moderna",
    description: "Gestão contábil e fiscal completa, focada na otimização de resultados e compliance.",
    href: "https://www.grupoqmax.com.br/contabil/index.php",
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
    href: "https://www.grupoqmax.com.br/talents/",
    logo: { src: "/brands/qmax-talents.png", alt: "Q-Max Talents" } as BrandAsset,
    logoSurface: "dark",
  },
  {
    id: "technology",
    name: "Q-Max Technology",
    short: "Technology",
    accent: "#5077ff",
    eyebrow: "Digital & inovação",
    description: "Estratégias digitais e campanhas personalizadas para aumentar a visibilidade da sua marca.",
    href: "https://www.grupoqmax.com.br/",
    logo: { src: "/brands/qmax-technology-white.png", alt: "Q-Max Technology" } as BrandAsset,
    logoSurface: "dark",
  },
  {
    id: "lagerhaus",
    name: "Lagerhaus",
    short: "Lagerhaus",
    accent: "#d8eb34",
    eyebrow: "Estrutura para negócios",
    description: "Endereço fiscal, comercial e espaços de coworking modernos para o seu negócio.",
    href: "https://www.grupoqmax.com.br/",
    logo: null as BrandAsset | null,
  },
] as const;

export const products = [
  {
    id: "qxback",
    name: "QXBACK",
    accent: "#79ef2d",
    kicker: "Indicação & bonificação",
    description: "Plataforma de gestão de indicações com cashback por serviços contratados, bônus por propostas enviadas e acompanhamento de ganhos.",
    features: ["Cashback por serviços contratados", "Bônus por propostas enviadas", "Gestão de indicações", "Ganhos em tempo real"],
    logo: { src: "/brands/qxback.png", alt: "QXBACK" } as BrandAsset,
  },
  {
    id: "qxsign",
    name: "QXSIGN",
    accent: "#16e1d4",
    kicker: "Identidade digital",
    description: "Atendimento especializado para certificados digitais, documentação digital e acesso a sistemas governamentais.",
    features: ["Atendimento especializado", "Documentação digital", "Certificados digitais", "Acesso a sistemas governamentais"],
    logo: null as BrandAsset | null,
  },
  {
    id: "finora",
    name: "FINORA",
    accent: "#b464ff",
    kicker: "Gestão para saúde",
    description: "Solução voltada à redução legal de impostos, gestão contábil e financeira e regularização documental para profissionais da saúde.",
    features: ["Redução legal de impostos", "Gestão contábil e financeira", "Regularização documental", "Foco em profissionais da saúde"],
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
  whatsapp: "+55 (11) 91295-7356",
  address: "R. Frei Gaspar, 941 - Conjunto 103-105, São Bernardo do Campo - SP",
} as const;
