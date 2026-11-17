import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Clock,
  GraduationCap,
  Handshake,
  HeartHandshake,
  Layers,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users2,
} from "lucide-react";


import { ScrollReveal } from "@/components/ScrollReveal";
import { CountUp } from "@/components/CountUp";
import "./talents.css";

export const metadata: Metadata = {
  title: "Q-Max Talents | Gestão de Pessoas, Recrutamento & Seleção e RH",
  description:
    "Soluções completas em Recursos Humanos, recrutamento especializado, treinamento e desenvolvimento de pessoas pelo Grupo Q-Max.",
  alternates: {
    canonical: "/talents",
  },
  openGraph: {
    title: "Q-Max Talents | Pessoas que Transformam Negócios",
    description:
      "Atração de talentos, desenvolvimento humano e gestão estratégica de RH.",
    url: "/talents",
    type: "website",
    siteName: "Grupo Q-Max",
    images: [
      {
        url: "/brands/talents-branco.png",
        width: 1200,
        height: 630,
        alt: "Q-Max Talents",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Q-Max Talents | Pessoas que Transformam Negócios",
    description: "Atração de talentos, desenvolvimento humano e gestão estratégica de RH.",
    images: ["/brands/talents-branco.png"],
  },
};

const services = [
  {
    number: "01",
    title: "Recrutamento & Seleção Estratégico",
    icon: UserCheck,
    text: "Atração e seleção de profissionais qualificados com avaliação técnica e comportamental aderente à cultura da sua empresa.",
    tags: ["Headhunting", "Fit Cultural", "Processo Ágil"],
  },
  {
    number: "02",
    title: "Treinamento & Desenvolvimento (T&D)",
    icon: GraduationCap,
    text: "Capacitação de lideranças, programas de desenvolvimento de equipes e workshops práticos para elevar a produtividade e retenção.",
    tags: ["Liderança", "Capacitação", "Workshops"],
  },
  {
    number: "03",
    title: "Gestão Operacional de RH & DP",
    icon: Briefcase,
    text: "Estruturação de rotinas de Departamento Pessoal, folha de pagamento, benefícios, admissão e conformidade com a legislação trabalhista.",
    tags: ["Folha de Pagamento", "Benefícios", "Compliance Trabalhista"],
  },
  {
    number: "04",
    title: "Consultoria em Cultura & Clima Organizacional",
    icon: HeartHandshake,
    text: "Diagnóstico de clima organizacional, planos de cargos e salários, avaliação de desempenho e estratégias para redução de turnover.",
    tags: ["Clima Organizacional", "Cargos e Salários", "Retenção de Talentos"],
  },
];

const steps = [
  {
    title: "Diagnóstico da vaga",
    text: "Entendemos o desafio da posição, a cultura da equipe e o perfil técnico e comportamental ideal.",
  },
  {
    title: "Atração & hunting",
    text: "Divulgação direcionada, base de talentos própria e busca ativa de profissionais no mercado.",
  },
  {
    title: "Triagem e avaliação",
    text: "Análise curricular, testes técnicos e avaliação comportamental para filtrar quem realmente tem fit.",
  },
  {
    title: "Entrevistas & shortlist",
    text: "Apresentamos uma lista enxuta de finalistas com parecer detalhado sobre cada candidato.",
  },
  {
    title: "Acompanhamento",
    text: "Apoio na proposta, na admissão e no período de adaptação do novo colaborador.",
  },
];

const segments = ["Indústria", "Varejo", "Saúde", "Tecnologia", "Serviços", "Logística", "Agronegócio", "Construção"];

const levels = ["Operacional", "Técnico", "Administrativo", "Gestão", "Executivo"];

const differentials = [
  {
    icon: Layers,
    title: "Integração com o Grupo Q-Max",
    text: "RH conectado à contabilidade, ao departamento pessoal e à tecnologia do grupo, sem retrabalho entre fornecedores.",
  },
  {
    icon: Clock,
    title: "Agilidade com critério",
    text: "Processos objetivos, com etapas e prazos definidos desde o início e comunicação constante sobre o andamento.",
  },
  {
    icon: Lock,
    title: "Sigilo e confidencialidade",
    text: "Condução discreta de vagas confidenciais e substituições, preservando a empresa e os candidatos.",
  },
  {
    icon: Handshake,
    title: "Parceria de longo prazo",
    text: "Acompanhamos o colaborador após a contratação e ajustamos a estratégia de RH conforme o negócio cresce.",
  },
];

const faqs = [
  {
    question: "Quais tipos de vaga a Q-Max Talents atende?",
    answer: "Atuamos do nível operacional ao executivo, em diferentes segmentos. Para cargos de liderança e posições críticas, aplicamos hunting e avaliação aprofundada.",
  },
  {
    question: "Quanto tempo leva um processo seletivo?",
    answer: "Depende do perfil e da complexidade da vaga. Na etapa de diagnóstico definimos junto com você um cronograma com cada fase do processo.",
  },
  {
    question: "Vocês conduzem vagas confidenciais?",
    answer: "Sim. Conduzimos processos sigilosos, sem expor o nome da empresa, inclusive para substituições estratégicas.",
  },
  {
    question: "É possível contratar só a parte de Departamento Pessoal?",
    answer: "Sim. Os serviços são modulares: você pode contratar recrutamento, T&D, DP ou consultoria separadamente ou de forma combinada.",
  },
  {
    question: "Como funciona o primeiro contato?",
    answer: "Fale com um consultor pelo WhatsApp ou e-mail. Fazemos uma conversa inicial para entender a necessidade e enviamos uma proposta personalizada.",
  },
];

const whatsappUrl =
  "https://wa.me/551128976514?text=Olá!%20Gostaria%20de%20conversar%20com%20a%20equipe%20da%20Q-Max%20Talents.";

export default function TalentsPage() {
  return (
    <main className="talents-page">

      {/* HERO SECTION */}
      <ScrollReveal animation="fade-up">
      <section className="talents-hero">
        <div className="talents-hero__glow talents-hero__glow--purple" />

        <div className="container talents-hero__grid">
          <div className="talents-hero__copy">
            <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
              <Users2 size={14} />
              GESTÃO DE PESSOAS & TALENTOS
            </span>

            <h1>
              As pessoas certas.
              <br />
              No lugar certo.
              <br />
              Resultados <em>consistentes.</em>
            </h1>

            <p>
              Conectamos empresas aos melhores profissionais e estruturamos uma gestão de RH estratégica para potencializar o crescimento do seu negócio.
            </p>

            <div className="talents-hero__actions">
              <a href="#servicos" className="talents-hero__primary">
                Conheça nossos serviços
                <ArrowRight size={17} />
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="talents-hero__primary"
                style={{ background: "rgba(255, 255, 255, 0.06)", border: "1px solid rgba(143, 58, 168, 0.3)", boxShadow: "none" }}
              >
                Falar com consultor
                <ArrowUpRight size={16} />
              </a>
            </div>
          </div>

          <div className="talents-hero__card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 16 }}>
              <span style={{ fontSize: "0.72rem", letterSpacing: "0.16em", fontWeight: 700, color: "#c084fc" }}>
                Q-MAX TALENTS · RH ESTRATÉGICO
              </span>
              <ShieldCheck size={20} color="#8f3aa8" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>VAGAS FECHADAS</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>
                  <CountUp end={1500} prefix="+" duration={1800} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>ASSERTIVIDADE</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#c084fc", marginTop: 4 }}>
                  <CountUp end={98} suffix="%" duration={1600} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>REDUÇÃO TURNOVER</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#ffffff", marginTop: 4 }}>
                  Até <CountUp end={40} suffix="%" duration={1400} />
                </strong>
              </div>

              <div style={{ background: "rgba(255, 255, 255, 0.03)", padding: 16, borderRadius: 16, border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <small style={{ color: "#a1a1aa", fontSize: "0.7rem", textTransform: "uppercase" }}>INTEGRAÇÃO</small>
                <strong style={{ display: "block", fontSize: "1.4rem", color: "#c084fc", marginTop: 4 }}>{"Grupo Q\u2011Max"}</strong>
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
            <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
              <Sparkles size={13} />
              ATUAÇÃO COMPLETA EM RH
            </span>

            <h2 style={{ fontSize: "clamp(2rem, 3.5vw, 3.2rem)", fontWeight: 800, margin: "16px 0", letterSpacing: "-0.04em" }}>
              Do recrutamento de ponta à gestão de alta performance.
            </h2>

            <p style={{ color: "#a1a1aa", fontSize: "1.1rem", lineHeight: 1.6 }}>
              Soluções personalizadas para atrair, reter e desenvolver os talentos que impulsionam o seu negócio.
            </p>
          </header>

          <div className="talents-services__grid">
            {services.map((service) => {
              const Icon = service.icon;
              return (
                <article key={service.number} className="talents-card">
                  <div>
                    <div className="talents-card__icon">
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
                          color: "#c084fc",
                          background: "rgba(143, 58, 168, 0.1)",
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

      {/* PROCESS SECTION */}
      <ScrollReveal animation="fade-up">
        <section id="processo" className="talents-section talents-section--alt">
          <div className="container">
            <header className="talents-section__head">
              <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
                <UserCheck size={13} />
                COMO RECRUTAMOS
              </span>
              <h2>Um processo claro, do briefing à adaptação.</h2>
              <p>Cada etapa tem objetivo definido e você acompanha o andamento do início ao fim.</p>
            </header>

            <ol className="talents-process">
              {steps.map((step, index) => (
                <li key={step.title} className="talents-process__step">
                  <span className="talents-process__number">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </ScrollReveal>

      {/* SEGMENTS SECTION */}
      <ScrollReveal animation="fade-up">
        <section className="talents-section">
          <div className="container talents-segments">
            <div>
              <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
                <Briefcase size={13} />
                PARA QUEM
              </span>
              <h2>Empresas de todos os portes e segmentos.</h2>
              <p>Adaptamos o processo à realidade do seu setor e ao nível da posição.</p>
            </div>

            <div className="talents-segments__lists">
              <div>
                <small>SEGMENTOS</small>
                <ul className="talents-chips">
                  {segments.map((segment) => (
                    <li key={segment}>{segment}</li>
                  ))}
                </ul>
              </div>
              <div>
                <small>NÍVEIS DE CARGO</small>
                <ul className="talents-chips talents-chips--outline">
                  {levels.map((level) => (
                    <li key={level}>{level}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* DIFFERENTIALS SECTION */}
      <ScrollReveal animation="fade-up">
        <section className="talents-section talents-section--alt">
          <div className="container">
            <header className="talents-section__head">
              <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
                <ShieldCheck size={13} />
                POR QUE A Q-MAX TALENTS
              </span>
              <h2>RH estratégico, com o apoio de um grupo inteiro.</h2>
            </header>

            <div className="talents-diff">
              {differentials.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="talents-card">
                    <div>
                      <div className="talents-card__icon">
                        <Icon size={22} />
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* FAQ SECTION */}
      <ScrollReveal animation="fade-up">
        <section id="duvidas" className="talents-section">
          <div className="container talents-faq">
            <header className="talents-section__head">
              <span className="eyebrow" style={{ color: "#c084fc", borderColor: "rgba(143, 58, 168, 0.3)" }}>
                <Sparkles size={13} />
                DÚVIDAS FREQUENTES
              </span>
              <h2>Perguntas frequentes</h2>
            </header>

            {faqs.map((faq) => (
              <details key={faq.question} className="talents-faq__item">
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* CONTACT SECTION */}
      <ScrollReveal animation="fade-up">
        <section id="contato" className="talents-section">
          <div className="container">
            <div className="talents-cta">
              <div className="talents-hero__glow talents-hero__glow--purple" />
              <h2>
                Vamos encontrar <em>as pessoas certas</em> para o seu negócio?
              </h2>
              <p>Conte o seu desafio de RH e receba uma proposta sob medida da Q-Max Talents.</p>
              <div className="talents-hero__actions">
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="talents-hero__primary">
                  Falar com consultor
                  <ArrowUpRight size={16} />
                </a>
                <a href="mailto:contato@grupoqmax.com.br" className="talents-hero__primary talents-hero__primary--ghost">
                  <Mail size={16} />
                  contato@grupoqmax.com.br
                </a>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>
    </main>
  );
}
