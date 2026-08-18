"use client";

import { QmaxInline } from "@/components/QmaxBrandText";

import Image from "next/image";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";
import { useState } from "react";

const companies = [
  {
    id: "audit",
    number: "01",
    name: "Q-Max Auditoria",
    category: "AUDITORIA & COMPLIANCE",
    color: "#ff315f",
    logo: "/brands/brand-auditoria.png",
    url: "https://grupoqmax.com.br/auditoria",
    icon: ShieldCheck,
    description:
      "Auditoria moderna e estratégica, com atuação em auditoria independente, controles internos e compliance.",
    services: [
      "Auditoria das Demonstrações Contábeis",
      "Gestão de Riscos e Processos",
      "Controles Internos e Compliance",
      "LGPD e DPO",
    ],
  },
  {
    id: "contabil",
    number: "02",
    name: "Q-Max Contábil",
    category: "CONTABILIDADE & GESTÃO",
    color: "#14d0c1",
    logo: "/brands/brand-contabil.png",
    url: "https://www.grupoqmax.com.br/contabil/index.php",
    icon: Building2,
    description:
      "Gestão contábil e fiscal completa, com soluções para apoiar conformidade, organização e decisões empresariais.",
    services: [
      "Assessoria Contábil, Fiscal e Trabalhista",
      "Abertura de Empresas",
      "Terceirização Financeira",
      "Recuperação Tributária",
    ],
  },
  {
    id: "talents",
    number: "03",
    name: "Q-Max Talents",
    category: "PESSOAS & RH",
    color: "#8f3aa8",
    logo: "/brands/brand-talents.png",
    url: "https://grupoqmax.com.br/talents/",
    icon: Users2,
    description:
      "Soluções completas em gestão de pessoas, unindo operação, estratégia e desenvolvimento de talentos.",
    services: [
      "Gestão Operacional",
      "Gestão Estratégica",
      "Recrutamento e Seleção",
      "Treinamento e Desenvolvimento",
    ],
  },
  {
    id: "technology",
    number: "04",
    name: "Q-Max Technology",
    category: "TECNOLOGIA & DIGITAL",
    color: "#3156ff",
    logo: "/brands/brand-technology.png",
    icon: Sparkles,
    description:
      "Estratégias digitais e campanhas personalizadas para aumentar a visibilidade da sua marca.",
    services: [
      "Estratégias Digitais",
      "Campanhas Personalizadas",
      "Visibilidade de Marca",
      "Integração com o Ecossistema Q-Max",
    ],
  },
  {
    id: "lagerhaus",
    number: "05",
    name: "Lagerhaus",
    category: "ESTRUTURA & COWORKING",
    color: "#ff8b2a",
    icon: Building2,
    logo: "/brands/lagerhaus-full.png",
    description:
      "Endereço fiscal, comercial e espaços de coworking modernos para apoiar a operação do seu negócio.",
    services: [
      "Endereço Fiscal",
      "Endereço Comercial",
      "Espaços de Coworking",
      "Estrutura para Negócios",
    ],
  },
];

export function Ecosystem() {
  const [activeIndex, setActiveIndex] = useState(3);
  const active = companies[activeIndex];
  const ActiveIcon = active.icon;

  return (
    <section
      id="empresas"
      className="ecosystem8"
      style={
        {
          "--eco": active.color,
        } as React.CSSProperties
      }
    >
      <div className="ecosystem8__ambient" />
      <div className="ecosystem8__grid" />

      <div className="container">
        <header className="ecosystem8__header">
          <div>
            <span className="eyebrow">
              <Sparkles size={13} />
              NOSSO ECOSSISTEMA
            </span>

            <h2>
              Cinco empresas.
              <br />
              <em>Uma estrutura conectada.</em>
            </h2>
          </div>

          <p>
            Cada empresa atua em uma especialidade própria, mas todas compartilham
            a mesma visão de qualidade, inovação e integração.
          </p>
        </header>

        <div className="ecosystem8__body">
          <nav className="ecosystem8__nav">
            {companies.map((company, index) => (
              <button
                type="button"
                key={company.id}
                className={activeIndex === index ? "active" : ""}
                style={
                  {
                    "--company": company.color,
                  } as React.CSSProperties
                }
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
              >
                <span className="ecosystem8__number">
                  {company.number}
                </span>

                <span className="ecosystem8__navCopy">
                  <small>{company.category}</small>
                  <strong>{company.name}</strong>
                </span>

                <i />
              </button>
            ))}
          </nav>

          <div className="ecosystem8__visual">
            <span className="ecosystem21__watermark" aria-hidden="true">
              {active.number}
            </span>

            <div className="ecosystem21__status" aria-hidden="true">
              <i />
              <span>{active.name}</span>
            </div>

            <div className="ecosystem8__network">
              <div className="ecosystem8__orbit orbit-a" />
              <div className="ecosystem8__orbit orbit-b" />
              <div className="ecosystem8__orbit orbit-c" />

              <div
                className="ecosystem8__core"
              >
                <Image
                  src="/brands/grupo-qmax-white.png"
                  alt="Grupo Q-Max"
                  width={170}
                  height={90}
                  style={{
                    width: "auto",
                    height: "auto",
                  }}
                />

                <span>GRUPO <QmaxInline>Q-MAX</QmaxInline></span>
              </div>

              <span className="ecosystem8__pulse pulse-a" />
              <span className="ecosystem8__pulse pulse-b" />
              <span className="ecosystem8__pulse pulse-c" />
            </div>
<article
                className="ecosystem8__detail"
              >
                <div className="ecosystem8__detailTop">
                  <span>{active.category}</span>
                  <ActiveIcon size={21} />
                </div>

                <div
                  className="ecosystem8__logo"
                >
                  {active.logo ? (
                    <img
                    src={active.logo}
                    alt={active.name}
                    className="ecosystem21__officialLogo"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                  ) : (
                    <strong>{active.name}</strong>
                  )}
                </div>

                <h3><QmaxInline>{active.name}</QmaxInline></h3>

                <p>{active.description}</p>

                <div className="ecosystem8__services">
                  {active.services.map((service) => (
                    <div key={service}>
                      <CheckCircle2 size={14} />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>

                {active.url ? (
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Conhecer {active.name}
                    <ArrowUpRight size={17} />
                  </a>
                ) : (
                  <a href="#contato">
                    Falar com a <QmaxInline>Q-Max</QmaxInline>
                    <ArrowUpRight size={17} />
                  </a>
                )}
              </article>
</div>
        </div>

        <div className="ecosystem8__footer">
          <span>ECOSSISTEMA EMPRESARIAL <QmaxInline>Q-MAX</QmaxInline></span>

          <div>
            {companies.map((company, index) => (
              <button
                type="button"
                key={company.id}
                aria-label={company.name}
                className={activeIndex === index ? "active" : ""}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
