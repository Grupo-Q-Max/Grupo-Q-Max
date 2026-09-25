import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building,
  Building2,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";
import { BackToTop } from "@/components/BackToTop";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CountUp } from "@/components/CountUp";
import "./lagerhaus.css";

export const metadata: Metadata = {
  title: "Lagerhaus | Endereço Fiscal, Comercial, Armazenagem & Coworking",
  description:
    "Estrutura completa para o seu negócio: endereço fiscal e comercial, armazenagem e estocagem inteligente, salas privativas e coworking.",
  alternates: {
    canonical: "/lagerhaus",
  },
  openGraph: {
    title: "Lagerhaus | Estrutura & Espaços para Negócios",
    description:
      "Endereço fiscal, estocagem e coworking moderno pelo Grupo Q-Max.",
    url: "/lagerhaus",
    type: "website",
  },
};

const services = [
  {
    number: "01",
    title: "Endereço Fiscal Estratégico",
    icon: Building2,
    text: "Domicílio fiscal regularizado e seguro para abertura ou transferência de empresas, com redução de custos fixos e gestão de correspondências.",
    tags: ["Abertura de CNPJ", "Gestão de Correspondência", "100% Regular"],
  },
  {
    number: "02",
    title: "Endereço Comercial de Prestígio",
    icon: MapPin,
    text: "Divulgue um endereço corporativo de alta credibilidade no seu site, materiais gráficos e cartões, transmitindo confiança para seus clientes.",
    tags: ["Credibilidade", "Localização Premium", "Presença de Marca"],
  },
  {
    number: "03",
    title: "Armazenagem & Estocagem Inteligente",
    icon: Boxes,
    text: "Espaço modular e seguro para estocagem e guarda de mercadorias, insumos, documentos e produtos de e-commerce com flexibilidade de metragem.",
    tags: ["Boxes Seguros", "E-commerce", "Flexibilidade"],
  },
  {
    number: "04",
    title: "Espaços de Coworking & Salas de Reunião",
    icon: Building,
    text: "Ambientes climatizados, internet de alta velocidade, salas de atendimento privativas e auditórios equipados para receber parceiros e clientes.",
    tags: ["Salas de Reunião", "Wi-Fi Dedicado", "Infraestrutura Completa"],
  },
];

export default function LagerhausPage() {
  return (
    <main className="lagerhaus-page">
      {/* HERO SECTION */}
      <ScrollReveal animation="fade-up">
      <section className="lagerhaus-hero">
        <div className="lagerhaus-hero__glow talents-hero__glow--amber" />

        <div className="container lagerhaus-hero__grid">
          <div className="lagerhaus-hero__copy">
            <span className="eyebrow" style={{ color: "#fbbf24", borderColor: "rgba(255, 139, 42, 0.3)" }}>
              <Building2 size={14} />
              ESTRUTURA PARA NEGÓCIOS & COWORKING
            </span>

            <h1>
              Estrutura moderna.
              <br />
              Endereço <em>estratégico.</em>
              <br />
              Seu negócio pronto.
            </h1>

            <p>
              Endereço fiscal, comercial, armazenagem/estocagem inteligente e espaços de coworking modernos para apoiar a operação da sua empresa.
            </p>

            <div className="lagerhaus-hero__actions">
              <a href="#servicos" className="lagerhaus-hero__primary">
                Conheça nossa estrutura
                <ArrowRight size={17} />
              </a>

              <a
                href="https://wa.me/551128976514?text=Olá!%20Gostaria%20de%20saber%20mais%20sobre%20o%20endereço%20fiscal%20e%20armazenagem%20da%20Lagerhaus."
                target="_blank"
                rel="noopener noreferrer"
                className="lagerhaus-hero__primary"
                style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(255, 139, 42, 0.3)", boxShadow: "none" }}
              >
                Falar no WhatsApp
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="lagerhaus-hero__card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 16 }}>
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.16em", fontWeight: 700, color: "#fbbf24" }}>
                LAGERHAUS · INFRAESTRUTURA
              </span>
              <ShieldCheck size={20} color="#ff8b2a" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>EMPRESAS SEDIADAS</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>
                  <CountUp end={250} prefix="+" duration={1800} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>LOCALIZAÇÃO</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#fbbf24", marginTop: 4 }}>São Paulo/ABC</strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>ARMAZENAGEM</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>Disponível</strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>INTEGRAÇÃO</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#fbbf24", marginTop: 4 }}>Grupo Q-Max</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* SERVICES SECTION */}
      <ScrollReveal animation="slide-right" delay={0.2}>
      <section id="servicos" style={{ padding: "clamp(80px, 8vw, 130px) 0" }}>
        <div className="container">
          <header className="text-center" style={{ maxWidth: 740, margin: "0 auto" }}>
            <span className="eyebrow" style={{ color: "#fbbf24", borderColor: "rgba(255, 139, 42, 0.3)" }}>
              <Boxes size={13} />
              ESTRUTURA COMPLETA
            </span>

            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, margin: "16px 0", letterSpacing: "-0.04em" }}>
              Tudo que sua empresa precisa para operar com eficiência.
            </h2>

            <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6 }}>
              Espaços pensados para negócios de todos os portes com custo flexível e sem amarras contratuais.
            </p>
          </header>

          <div className="lagerhaus-services__grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.number} className="lagerhaus-card">
                  <div>
                    <div className="lagerhaus-card__icon">
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
                          color: "#fbbf24",
                          background: "rgba(255, 139, 42, 0.1)",
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
      </ScrollReveal>



      <FloatingWhatsApp />
      <BackToTop />
    </main>
  );
}
