import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Calculator, ShieldCheck, Sparkles, TrendingUp, Users } from "lucide-react";
import { TaxDiagnosticCalculator } from "@/components/TaxDiagnosticCalculator";
import { ScrollReveal } from "@/components/ScrollReveal";

export const metadata: Metadata = {
  title: "Diagnóstico Empresarial & Tributário Gratuito | Grupo Q-Max",
  description:
    "Simule o potencial de economia tributária e ganho de eficiência operacional da sua empresa com as soluções integradas do Grupo Q-Max.",
  alternates: {
    canonical: "/diagnostico",
  },
  openGraph: {
    title: "Diagnóstico Tributário & Gestão | Grupo Q-Max",
    description: "Descubra quanto sua empresa pode economizar anualmente com planejamento tributário e conformidade fiscal estratégica.",
    url: "/diagnostico",
    type: "website",
    siteName: "Grupo Q-Max",
    images: [
      {
        url: "/brands/grupo-qmax-white.png",
        width: 1200,
        height: 630,
        alt: "Diagnóstico Grupo Q-Max",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Diagnóstico Empresarial & Tributário Gratuito | Grupo Q-Max",
    description: "Simule a economia da sua empresa em poucos segundos com o Grupo Q-Max.",
    images: ["/brands/grupo-qmax-white.png"],
  },
};

export default function DiagnosticoPage() {
  return (
    <main className="min-h-screen bg-[#050506] text-white pt-24 pb-20">
      {/* Top Breadcrumb & Voltar */}
      <div className="container" style={{ paddingBottom: 16 }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.86rem",
            color: "#a1a1aa",
            textDecoration: "none",
            transition: "color 0.2s ease",
          }}
        >
          <ArrowLeft size={16} /> Voltar à Página Principal
        </Link>
      </div>

      {/* Hero Header */}
      <div className="container" style={{ textAlign: "center", maxWidth: 840, margin: "0 auto", paddingBottom: 32 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 16px",
            borderRadius: 9999,
            background: "rgba(217, 15, 129, 0.12)",
            border: "1px solid rgba(217, 15, 129, 0.3)",
            color: "#ff2f91",
            fontSize: "0.8rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            marginBottom: 16,
          }}
        >
          <Calculator size={15} />
          <span>Simulador Executivo Oficial</span>
        </div>

        <h1 style={{ fontSize: "2.6rem", fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.03em", margin: "0 0 16px" }}>
          Diagnóstico Tributário &amp; Eficiência Empresarial
        </h1>

        <p style={{ fontSize: "1.1rem", color: "#a1a1aa", lineHeight: 1.6, margin: 0 }}>
          Descubra a redução de carga tributária e o aumento de margem líquida que o ecossistema integrado do Grupo Q-Max pode gerar para o seu segmento.
        </p>
      </div>

      {/* Componente do Simulador */}
      <ScrollReveal animation="fade-up">
        <TaxDiagnosticCalculator />
      </ScrollReveal>

      {/* Diferenciais em Grid */}
      <div className="container" style={{ paddingTop: 64, maxWidth: 1080 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: "0.8rem", color: "#14d0c1", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Metodologia Grupo Q-Max
          </span>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: 8 }}>
            Como garantimos a segurança da sua economia
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ color: "#14d0c1", marginBottom: 12 }}>
              <ShieldCheck size={28} />
            </div>
            <strong style={{ display: "block", fontSize: "1.1rem", marginBottom: 8, color: "#fff" }}>
              100% em Conformidade Legal
            </strong>
            <p style={{ fontSize: "0.88rem", color: "#a1a1aa", lineHeight: 1.5, margin: 0 }}>
              Utilizamos jurisprudência consolidada, incentivos fiscais e reestruturação societária homologada por auditores independentes.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ color: "#ff2f91", marginBottom: 12 }}>
              <TrendingUp size={28} />
            </div>
            <strong style={{ display: "block", fontSize: "1.1rem", marginBottom: 8, color: "#fff" }}>
              Impacto Direto no Caixa
            </strong>
            <p style={{ fontSize: "0.88rem", color: "#a1a1aa", lineHeight: 1.5, margin: 0 }}>
              A redução do desembolso tributário é revertida imediatamente para reinvestimento, expansão de equipe e distribuição de lucros.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ color: "#b26bff", marginBottom: 12 }}>
              <Users size={28} />
            </div>
            <strong style={{ display: "block", fontSize: "1.1rem", marginBottom: 8, color: "#fff" }}>
              Suporte Consultivo Dedicado
            </strong>
            <p style={{ fontSize: "0.88rem", color: "#a1a1aa", lineHeight: 1.5, margin: 0 }}>
              Nossos especialistas em Direito Tributário, Contabilidade e Controladoria acompanham a transição em cada etapa.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

