import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Handshake,
  Receipt,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { QmaxEcosystemHeader } from "@/components/QmaxEcosystemHeader";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { BackToTop } from "@/components/BackToTop";
import { TaxDiagnosticCalculator } from "@/components/TaxDiagnosticCalculator";
import { QmaxInline } from "@/components/QmaxBrandText";
import { CountUp } from "@/components/CountUp";
import "./contabil.css";

export const metadata: Metadata = {
  title: "Q-Max Contábil | Contabilidade Moderna, BPO & Gestão Tributária",
  description:
    "Gestão contábil e fiscal completa, BPO financeiro, planejamento tributário e abertura de empresas com inteligência e compliance.",
  alternates: {
    canonical: "/contabil",
  },
  openGraph: {
    title: "Q-Max Contábil | Inteligência para seu Negócio Prosperar",
    description:
      "Contabilidade consultiva, BPO financeiro e planejamento tributário estratégico pelo Grupo Q-Max.",
    url: "/contabil",
    type: "website",
  },
};

const services = [
  {
    number: "01",
    title: "Assessoria Contábil & Fiscal",
    icon: FileSpreadsheet,
    text: "Escrituração contábil e fiscal completa, apuração de impostos, fechamento de balanços e cumprimento rigoroso de todas as obrigações acessórias com total segurança.",
    tags: ["Conformidade", "Fechamento Mensal", "SPED / ECF"],
  },
  {
    number: "02",
    title: "Terceirização - BPO Financeiro",
    icon: BarChart3,
    text: "Gestão completa de contas a pagar, receber, conciliação bancária diária e relatórios de fluxo de caixa em tempo real para você focar no crescimento da sua empresa.",
    tags: ["Contas a Pagar/Receber", "Fluxo de Caixa", "Conciliação"],
  },
  {
    number: "03",
    title: "Planejamento Tributário Estratégico",
    icon: Scale,
    text: "Análise profunda do enquadramento tributário (Simples Nacional, Lucro Presumido ou Lucro Real) para reduzir legalmente a carga de impostos da sua empresa.",
    tags: ["Redução de Custos", "Compliance Fiscal", "Economia Legal"],
  },
  {
    number: "04",
    title: "Abertura & Legalização de Empresas",
    icon: Building2,
    text: "Processo ágil e desburocratizado para abertura de CNPJ, alteração contratual, regularização societária e emissão de alvarás e licenças municipais e estaduais.",
    tags: ["Abertura Rápida", "Contrato Social", "Alvarás"],
  },
];

export default function ContabilPage() {
  return (
    <main className="contabil-page">
      <QmaxEcosystemHeader
        brand="contabil"
        logo="/brands/brand-contabil.png"
        accent="#14d0c1"
      />

      {/* HERO SECTION */}
      <section className="contabil-hero">
        <div className="contabil-hero__glow contabil-hero__glow--cyan" />
        <div className="contabil-hero__glow contabil-hero__glow--magenta" />

        <div className="container contabil-hero__grid">
          <div className="contabil-hero__copy">
            <span className="eyebrow">
              <Sparkles size={14} />
              CONTABILIDADE CONSULTIVA & ESTRATÉGICA
            </span>

            <h1>
              Contabilidade moderna.
              <br />
              Resultados <em>inteligentes.</em>
            </h1>

            <p>
              Transforme a gestão contábil, fiscal e financeira do seu negócio em uma alavanca de crescimento sustentável e economia tributária real.
            </p>

            <div className="contabil-hero__actions">
              <a href="#especialidades" className="contabil-hero__primary">
                Conheça nossos serviços
                <ArrowRight size={17} />
              </a>

              <a
                href="https://wa.me/5511912957356?text=Olá!%20Gostaria%20de%20conversar%20com%20um%20especialista%20da%20Q-Max%20Contábil."
                target="_blank"
                rel="noopener noreferrer"
                className="contabil-hero__ghost"
              >
                Falar com um especialista
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="contabil-hero__card">
            <div className="contabil-hero__cardHeader">
              <span>PAINEL DE PERFORMANCE CONTÁBIL</span>
              <ShieldCheck size={20} color="#14d0c1" />
            </div>

            <div className="contabil-hero__metrics">
              <div className="contabil-hero__metric">
                <small>CLIENTES ATENDIDOS</small>
                <strong>
                  <CountUp end={400} prefix="+" duration={1800} />
                </strong>
              </div>

              <div className="contabil-hero__metric">
                <small>COMPLIANCE FISCAL</small>
                <strong>
                  <CountUp end={100} suffix="%" duration={1600} />
                </strong>
              </div>

              <div className="contabil-hero__metric">
                <small>ECONOMIA TRIBUTÁRIA</small>
                <strong>
                  Até <CountUp end={30} suffix="%" duration={1400} />
                </strong>
              </div>

              <div className="contabil-hero__metric">
                <small>TIME DE APOIO</small>
                <strong>
                  <CountUp end={32} suffix=" Especialistas" duration={1200} />
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="especialidades" className="contabil-services">
        <div className="container">
          <header className="text-center" style={{ maxWidth: 720, margin: "0 auto" }}>
            <span className="eyebrow">
              <Sparkles size={13} />
              NOSSAS ESPECIALIDADES
            </span>

            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, margin: "16px 0", letterSpacing: "-0.04em" }}>
              Soluções completas para cada camada financeira da sua empresa.
            </h2>

            <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6 }}>
              Da conformidade fiscal do dia a dia ao planejamento tributário e terceirização financeira estratégica.
            </p>
          </header>

          <div className="contabil-services__grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.number} className="contabil-service-card">
                  <div>
                    <div className="contabil-service-card__icon">
                      <Icon size={24} />
                    </div>

                    <h3>{service.title}</h3>
                    <p>{service.text}</p>
                  </div>

                  <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {service.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#14d0c1",
                          background: "rgba(20, 208, 193, 0.08)",
                          padding: "4px 10px",
                          borderRadius: 6,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* DIAGNOSTIC CALCULATOR */}
      <TaxDiagnosticCalculator />

      {/* FOOTER */}
      <footer className="finish-footer" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div className="container finish-footer__top">
          <div className="finish-footer__brand">
            <Link href="/contabil" aria-label="Q-Max Contábil">
              <Image
                src="/brands/brand-contabil.png"
                alt="Q-Max Contábil"
                width={180}
                height={60}
                sizes="180px"
                style={{
                  width: "auto",
                  height: "48px",
                }}
              />
            </Link>

            <p>
              Contabilidade moderna, BPO financeiro e planejamento tributário estratégico com inteligência e proximidade.
            </p>

            <div className="finish-footer__quickContact">
              <a
                href="https://wa.me/5511912957356"
                target="_blank"
                rel="noopener noreferrer"
                className="finish-footer__quickBtn"
                aria-label="WhatsApp Q-Max Contábil"
              >
                <span>● WhatsApp: (11) 91295-7356</span>
              </a>
              <a
                href="mailto:contato@grupoqmax.com.br"
                className="finish-footer__quickBtn"
                aria-label="E-mail Q-Max Contábil"
              >
                <span>contato@grupoqmax.com.br</span>
              </a>
            </div>
          </div>

          <div className="finish-footer__nav">
            <div>
              <strong>NAVEGAÇÃO</strong>
              <Link href="/contabil">Início</Link>
              <a href="#especialidades">Especialidades</a>
              <a href="#diagnostico">Simulador</a>
            </div>

            <div>
              <strong>SERVIÇOS</strong>
              <a href="#especialidades">Assessoria Fiscal</a>
              <a href="#especialidades">BPO Financeiro</a>
              <a href="#especialidades">Planejamento Tributário</a>
              <a href="#especialidades">Abertura de Empresas</a>
            </div>

            <div>
              <strong>ECOSSISTEMA</strong>
              <Link href="/">Grupo Q-Max</Link>
              <Link href="/auditoria">Q-Max Auditoria</Link>
              <a href="https://grupoqmax.com.br/talents/" target="_blank" rel="noopener noreferrer">Q-Max Talents</a>
              <a href="https://lagerhaus.work" target="_blank" rel="noopener noreferrer">Lagerhaus</a>
            </div>
          </div>
        </div>

        <div className="container finish-footer__bottom">
          <span>© 2026 Q-Max Contábil · Uma empresa do Grupo Q-Max<span className="qmax-punctuation">.</span></span>

          <div>
            <span>São Bernardo do Campo · SP</span>
            <i />
            <span>Contabilidade Consultiva, BPO e Planejamento.</span>
          </div>
        </div>
      </footer>

      <FloatingWhatsApp />
      <BackToTop />
    </main>
  );
}
