import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Cpu,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { QmaxEcosystemHeader } from "@/components/QmaxEcosystemHeader";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { BackToTop } from "@/components/BackToTop";
import { QmaxInline } from "@/components/QmaxBrandText";
import { CountUp } from "@/components/CountUp";
import "./technology.css";

export const metadata: Metadata = {
  title: "Q-Max Technology | Desenvolvimento de Ferramentas, Digital & Inovação",
  description:
    "Estratégias digitais, desenvolvimento de ferramentas sob medida e programas de indicação para acelerar marcas.",
  alternates: {
    canonical: "/technology",
  },
  openGraph: {
    title: "Q-Max Technology | Digital & Inovação com Propósito",
    description:
      "Soluções digitais inteligentes e ferramentas sob medida pelo Grupo Q-Max.",
    url: "/technology",
    type: "website",
  },
};

const services = [
  {
    number: "01",
    title: "Desenvolvimento de Ferramentas Digitais",
    icon: Code2,
    text: "Criação de plataformas, sistemas web, painéis de gestão e integrações de software focadas em automação e produtividade.",
    tags: ["Sistemas Web", "Automação", "Integrações"],
  },
  {
    number: "02",
    title: "Programas de Indicação & Bonificação",
    icon: Zap,
    text: "Estruturação tecnológica de plataformas de indicação (Member Get Member) com rastreamento de receita e bonificação automática.",
    tags: ["MGM", "Gamificação", "Receita por Indicação"],
  },
  {
    number: "03",
    title: "Estratégias Digitais & Performance",
    icon: Rocket,
    text: "Posicionamento digital, tráfego estratégico e infraestrutura de alta conversão para marcas que desejam expandir autoridade.",
    tags: ["Performance", "Growth", "Autoridade"],
  },
  {
    number: "04",
    title: "Integração & Transformação Digital",
    icon: Cpu,
    text: "Diagnóstico e conexão de ferramentas em nuvem para eliminar gargalos manuais e transformar dados em inteligência competitiva.",
    tags: ["Cloud", "APIs", "Eficiência"],
  },
];

export default function TechnologyPage() {
  return (
    <main className="technology-page">
      <QmaxEcosystemHeader
        brand="technology"
        logo="/brands/brand-technology.png"
        accent="#3156ff"
      />

      {/* HERO SECTION */}
      <section className="technology-hero">
        <div className="technology-hero__glow technology-hero__glow--blue" />

        <div className="container technology-hero__grid">
          <div className="technology-hero__copy">
            <span className="eyebrow" style={{ color: "#60a5fa", borderColor: "rgba(49, 86, 255, 0.3)" }}>
              <Sparkles size={14} />
              TECNOLOGIA & INOVAÇÃO
            </span>

            <h1>
              Tecnologia que
              <br />
              constrói o <em>futuro</em>
              <br />
              do seu negócio.
            </h1>

            <p>
              Desenvolvimento de ferramentas sob medida, programas de indicação e soluções digitais inteligentes conectadas ao ecossistema <QmaxInline>Q-Max</QmaxInline>.
            </p>

            <div className="technology-hero__actions">
              <a href="#servicos" className="technology-hero__primary">
                Conheça nossas soluções
                <ArrowRight size={17} />
              </a>

              <a
                href="https://wa.me/5511912957356?text=Olá!%20Gostaria%20de%20conversar%20com%20a%20equipe%20da%20Q-Max%20Technology."
                target="_blank"
                rel="noopener noreferrer"
                className="technology-hero__primary"
                style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(49, 86, 255, 0.3)", boxShadow: "none" }}
              >
                Falar com nosso time
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="technology-hero__card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 16 }}>
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.16em", fontWeight: 700, color: "#60a5fa" }}>
                Q-MAX TECHNOLOGY · STACK DIGITAL
              </span>
              <ShieldCheck size={20} color="#3156ff" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>PROJETOS ENTREGUES</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>
                  <CountUp end={120} prefix="+" duration={1800} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>DISPONIBILIDADE</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#60a5fa", marginTop: 4 }}>
                  <CountUp end={99.9} decimals={1} suffix="%" duration={1600} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>SOLUÇÕES DIGITAIS</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>SaaS & Web</strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>INTEGRAÇÃO</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#60a5fa", marginTop: 4 }}>Grupo Q-Max</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES SECTION */}
      <section id="servicos" style={{ padding: "clamp(80px, 8vw, 130px) 0" }}>
        <div className="container">
          <header className="text-center" style={{ maxWidth: 740, margin: "0 auto" }}>
            <span className="eyebrow" style={{ color: "#60a5fa", borderColor: "rgba(49, 86, 255, 0.3)" }}>
              <Layers size={13} />
              NOSSAS SOLUÇÕES DIGITAIS
            </span>

            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, margin: "16px 0", letterSpacing: "-0.04em" }}>
              Software, automação e ferramentas que geram escala.
            </h2>

            <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6 }}>
              Da concepção de plataformas ao desenvolvimento de integrações de alta performance.
            </p>
          </header>

          <div className="technology-services__grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.number} className="technology-card">
                  <div>
                    <div className="technology-card__icon">
                      <Icon size={24} />
                    </div>

                    <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#ffffff", marginBottom: 12 }}>{service.title}</h3>
                    <p style={{ color: "#a1a1aa", fontSize: "0.92rem", lineHeight: 1.6 }}>{service.text}</p>
                  </div>

                  <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {service.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#60a5fa",
                          background: "rgba(49, 86, 255, 0.1)",
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

      {/* FOOTER */}
      <footer className="finish-footer" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
        <div className="container finish-footer__top">
          <div className="finish-footer__brand">
            <Link href="/technology" aria-label="Q-Max Technology">
              <Image
                src="/brands/brand-technology.png"
                alt="Q-Max Technology"
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
              Estratégias digitais, programas de indicação e desenvolvimento de ferramentas para acelerar marcas.
            </p>

            <div className="finish-footer__quickContact">
              <a
                href="https://wa.me/5511912957356"
                target="_blank"
                rel="noopener noreferrer"
                className="finish-footer__quickBtn"
                aria-label="WhatsApp Q-Max Technology"
              >
                <span>● WhatsApp: (11) 91295-7356</span>
              </a>
              <a
                href="mailto:contato@grupoqmax.com.br"
                className="finish-footer__quickBtn"
                aria-label="E-mail Q-Max Technology"
              >
                <span>contato@grupoqmax.com.br</span>
              </a>
            </div>
          </div>

          <div className="finish-footer__nav">
            <div>
              <strong>NAVEGAÇÃO</strong>
              <Link href="/technology">Início</Link>
              <a href="#servicos">Soluções</a>
            </div>

            <div>
              <strong>ESPECIALIDADES</strong>
              <a href="#servicos">Desenvolvimento de Software</a>
              <a href="#servicos">Programas de Indicação</a>
              <a href="#servicos">Estratégias Digitais</a>
              <a href="#servicos">Transformação Cloud</a>
            </div>

            <div>
              <strong>ECOSSISTEMA</strong>
              <Link href="/">Grupo Q-Max</Link>
              <Link href="/contabil">Q-Max Contábil</Link>
              <Link href="/auditoria">Q-Max Auditoria</Link>
              <Link href="/talents">Q-Max Talents</Link>
            </div>
          </div>
        </div>

        <div className="container finish-footer__bottom">
          <span>© 2026 Q-Max Technology · Uma empresa do Grupo Q-Max<span className="qmax-punctuation">.</span></span>

          <div>
            <span>São Bernardo do Campo · SP</span>
            <i />
            <span>Digital, Inovação e Atitude.</span>
          </div>
        </div>
      </footer>

      <FloatingWhatsApp />
      <BackToTop />
    </main>
  );
}
