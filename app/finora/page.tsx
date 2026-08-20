import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  HeartPulse,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  FileCheck2,
  Users,
} from "lucide-react";
import { QmaxEcosystemHeader } from "@/components/QmaxEcosystemHeader";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { TaxDiagnosticCalculator } from "@/components/TaxDiagnosticCalculator";
import { QmaxInline } from "@/components/QmaxBrandText";
import { CountUp } from "@/components/CountUp";
import "./finora.css";

export const metadata: Metadata = {
  title: "FINORA | Gestão Financeira & Planejamento para Clínicas Odontológicas",
  description:
    "Inteligência financeira, redução legal de impostos, regularização documental e liberdade profissional para dentistas e clínicas odontológicas.",
  alternates: {
    canonical: "/finora",
  },
  openGraph: {
    title: "FINORA | Liberdade Profissional para sua Clínica",
    description:
      "Solução do Grupo Q-Max especializada em planejamento tributário e gestão para profissionais da saúde e odontologia.",
    url: "/finora",
    type: "website",
  },
};

const pillars = [
  {
    number: "01",
    title: "Planejamento Tributário Especializado",
    icon: Scale,
    text: "Enquadramento tributário cirúrgico (Equiparação Hospitalar / Livro Caixa / Simples vs Presumido) para reduzir legalmente até 60% dos impostos da sua clínica odontológica.",
    tags: ["Equiparação Hospitalar", "Economia Legal", "Redução de Alíquota"],
  },
  {
    number: "02",
    title: "BPO Financeiro & Fluxo de Caixa",
    icon: TrendingUp,
    text: "Gestão profissional das contas da clínica, controle de recebíveis de cartões e convênios, conciliação diária e relatórios de lucratividade por procedimento.",
    tags: ["Gestão de Convênios", "Conciliação de Cartão", "Lucro Real por Cadeira"],
  },
  {
    number: "03",
    title: "Regularização Documental & CRO",
    icon: FileCheck2,
    text: "Apoio completo para emissão de alvarás da Vigilância Sanitária, registro no CRO/CRM, adequação de contratos com dentistas parceiros (Lei do Salão-Parceiro/Clínica).",
    tags: ["Vigilância Sanitária", "Contratos Seguros", "Compliance CRO"],
  },
  {
    number: "04",
    title: "Liberdade Profissional",
    icon: HeartPulse,
    text: "Mais tempo para você se dedicar aos seus pacientes e à sua vida pessoal, com a certeza de que os números da sua clínica estão sendo cuidados por especialistas.",
    tags: ["Mais Tempo Livre", "Segurança Fiscal", "Crescimento Previsível"],
  },
];

export default function FinoraPage() {
  return (
    <main className="finora-page">
      <QmaxEcosystemHeader
        brand="group"
        logo="/brands/grupo-qmax-white.png"
        accent="#a45cff"
      />

      {/* HERO SECTION */}
      <section className="finora-hero">
        <div className="finora-hero__glow finora-hero__glow--violet" />
        <div className="finora-hero__glow finora-hero__glow--magenta" />

        <div className="container finora-hero__grid">
          <div className="finora-hero__copy">
            <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(164, 92, 255, 0.3)" }}>
              <Stethoscope size={14} />
              EXCLUSIVO PARA CLÍNICAS ODONTOLÓGICAS
            </span>

            <h1>
              Menos impostos.
              <br />
              Mais <em>liberdade profissional.</em>
            </h1>

            <p>
              Gestão contábil, financeira e tributária desenhada sob medida para dentistas e gestores de clínicas que buscam lucro máximo e conformidade absoluta.
            </p>

            <div className="finora-hero__actions">
              <a href="#pilares" className="finora-hero__primary">
                Conheça a FINORA
                <ArrowRight size={17} />
              </a>

              <a
                href="https://wa.me/5511912957356?text=Olá!%20Tenho%20uma%20clínica%20odontológica%20e%20gostaria%20de%20um%20diagnóstico%20com%20a%20FINORA."
                target="_blank"
                rel="noopener noreferrer"
                className="finora-hero__primary"
                style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(164, 92, 255, 0.3)", boxShadow: "none" }}
              >
                Falar no WhatsApp
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="finora-hero__card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.16em", fontWeight: 700, color: "#c084fc" }}>
                FINORA · DIAGNÓSTICO ODONTO
              </span>
              <ShieldCheck size={20} color="#a45cff" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 18, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.72rem", textTransform: "uppercase" }}>REDUÇÃO TRIBUTÁRIA ESTIMADA</small>
                <strong style={{ display: "block", fontSize: "1.8rem", color: "#c084fc", marginTop: 4 }}>
                  Até <CountUp end={60} suffix="%" duration={1600} />
                </strong>
                <span style={{ fontSize: "0.82rem", color: "#71717a" }}>Através de equiparação hospitalar e segregação de receitas</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 14, borderRadius: 14, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <small style={{ color: "#a1a1aa", fontSize: "0.7rem" }}>SEGURANÇA JURÍDICA</small>
                  <strong style={{ display: "block", fontSize: "1.2rem", color: "#ffffff" }}>100% Legal</strong>
                </div>
                <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 14, borderRadius: 14, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                  <small style={{ color: "#a1a1aa", fontSize: "0.7rem" }}>FOCO TOTAL</small>
                  <strong style={{ display: "block", fontSize: "1.2rem", color: "#ffffff" }}>Odontologia</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PILARES SECTION */}
      <section id="pilares" style={{ padding: "clamp(80px, 8vw, 130px) 0" }}>
        <div className="container">
          <header className="text-center" style={{ maxWidth: 740, margin: "0 auto" }}>
            <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(164, 92, 255, 0.3)" }}>
              <Sparkles size={13} />
              COMO TRANSFORMAMOS SUA CLÍNICA
            </span>

            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, margin: "16px 0", letterSpacing: "-0.04em" }}>
              Inteligência que cuida das contas enquanto você cuida dos sorrisos.
            </h2>

            <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6 }}>
              Uma estrutura contábil e financeira que protege seu patrimônio e maximiza seus lucros.
            </p>
          </header>

          <div className="finora-benefits-grid">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article key={pillar.number} className="finora-card">
                  <div>
                    <div className="finora-card__icon">
                      <Icon size={24} />
                    </div>

                    <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: 12 }}>{pillar.title}</h3>
                    <p style={{ color: "#a1a1aa", fontSize: "0.92rem", lineHeight: 1.6 }}>{pillar.text}</p>
                  </div>

                  <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pillar.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#c084fc",
                          background: "rgba(164, 92, 255, 0.1)",
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
            <strong style={{ fontSize: "1.8rem", letterSpacing: "-0.03em", color: "#c084fc" }}>
              FINORA
            </strong>

            <p>
              Solução do Grupo Q-Max em gestão contábil, financeira e planejamento tributário estratégico para clínicas odontológicas.
            </p>

            <div className="finish-footer__quickContact">
              <a
                href="https://wa.me/5511912957356"
                target="_blank"
                rel="noopener noreferrer"
                className="finish-footer__quickBtn"
                aria-label="WhatsApp FINORA"
              >
                <span>● WhatsApp: (11) 91295-7356</span>
              </a>
              <a
                href="mailto:contato@grupoqmax.com.br"
                className="finish-footer__quickBtn"
                aria-label="E-mail FINORA"
              >
                <span>contato@grupoqmax.com.br</span>
              </a>
            </div>
          </div>

          <div className="finish-footer__nav">
            <div>
              <strong>NAVEGAÇÃO</strong>
              <Link href="/finora">Início</Link>
              <a href="#pilares">Pilares</a>
              <a href="#diagnostico">Simulador</a>
            </div>

            <div>
              <strong>ESPECIALIDADES</strong>
              <a href="#pilares">Planejamento Tributário</a>
              <a href="#pilares">BPO Odontológico</a>
              <a href="#pilares">Contratos e CRO</a>
              <a href="#pilares">Equiparação Hospitalar</a>
            </div>

            <div>
              <strong>ECOSSISTEMA</strong>
              <Link href="/">Grupo Q-Max</Link>
              <Link href="/contabil">Q-Max Contábil</Link>
              <Link href="/auditoria">Q-Max Auditoria</Link>
              <a href="https://lagerhaus.work" target="_blank" rel="noopener noreferrer">Lagerhaus</a>
            </div>
          </div>
        </div>

        <div className="container finish-footer__bottom">
          <span>© 2026 FINORA · Uma solução do Grupo Q-Max<span className="qmax-punctuation">.</span></span>

          <div>
            <span>São Bernardo do Campo · SP</span>
            <i />
            <span>Inteligência Financeira para Clínicas Odontológicas.</span>
          </div>
        </div>
      </footer>

      <FloatingWhatsApp />
    </main>
  );
}
