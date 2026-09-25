import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  FileSearch,
  Fingerprint,
  Gauge,
  Layers3,
  LockKeyhole,
  Search,
  ShieldCheck,
  ScanSearch,
  Compass,
  GraduationCap,
} from "lucide-react";

import { AuditoriaMotion } from "@/components/AuditoriaMotion";
import { AuditoriaWhatsApp } from "@/components/AuditoriaWhatsApp";
import { BackToTop } from "@/components/BackToTop";
import { QmaxBrandUppercase } from "@/components/QmaxBrandText";
import { QmaxEcosystemHeader } from "@/components/QmaxEcosystemHeader";
import { ScrollReveal } from "@/components/ScrollReveal";

import "./auditoria.css";

export const metadata: Metadata = {
  title: "Q-Max Auditoria | Auditoria Independente e Estratégica",
  description:
    "Auditoria independente, controles internos, compliance e LGPD com visão estratégica para empresas.",
  alternates: {
    canonical: "/auditoria",
  },
  openGraph: {
    title: "Q-Max Auditoria | Confiança para decidir",
    description:
      "Auditoria, controles internos, compliance e inteligência para organizações que buscam decisões mais consistentes.",
    url: "/auditoria",
    type: "website",
  },
};

const services = [
  {
    number: "01",
    icon: FileSearch,
    title: "Auditoria das Demonstrações Contábeis",
    text: "Análises estruturadas e independentes para ampliar a confiabilidade das informações e fortalecer a tomada de decisão.",
  },
  {
    number: "02",
    icon: ShieldCheck,
  ScanSearch,
  Compass,
  GraduationCap,
    title: "Controles Internos e Compliance",
    text: "Avaliação de processos, controles e práticas de governança com foco em segurança, consistência e evolução.",
  },
  {
    number: "03",
    icon: Fingerprint,
    title: "LGPD e DPO",
    text: "Apoio à governança de dados e à adequação de processos para uma operação mais responsável e preparada.",
  },
];

const principles = [
  {
    icon: Search,
    title: "Profundidade",
    text: "Entender o que está por trás dos números, processos e controles.",
  },
  {
    icon: LockKeyhole,
    title: "Independência",
    text: "Análises conduzidas com rigor técnico, responsabilidade e objetividade.",
  },
  {
    icon: BarChart3,
    title: "Clareza",
    text: "Informação organizada para apoiar decisões com maior segurança.",
  },
  {
    icon: Gauge,
    title: "Evolução",
    text: "Uma visão que identifica riscos, oportunidades e caminhos de melhoria.",
  },
];

export default function AuditoriaPage() {
  return (
    <main className="audit67">
      <AuditoriaMotion />
      <AuditoriaWhatsApp />
      <QmaxEcosystemHeader
        brand="auditoria"
        logo="/brands/auditoria-branco.png"
        accent="#f22b22"
      />

      <section className="audit67__hero">
        <div className="audit67__heroGlow audit67__heroGlow--one" />
        <div className="audit67__heroGlow audit67__heroGlow--two" />

        <div className="audit67__heroGrid">
          <ScrollReveal animation="slide-left">
            <div className="audit67__heroCopy">
              <div className="audit67__eyebrow">
                <span />
                <strong className="audit67__eyebrowLabel">Q-MAX AUDITORIA</strong>
              </div>

              <h1>
                Precisão para
                <br />
                <strong>enxergar.</strong>
                <br />
                Confiança para
                <br />
                <em>decidir.</em>
              </h1>

              <p>
                Auditoria, governança e inteligência para organizações que
                precisam transformar informação em decisões consistentes.
              </p>

              <div className="audit67__heroActions">
                <a className="audit67__primary" href="#atuacao">
                  Conheça nossa atuação
                  <ArrowRight size={18} />
                </a>

                <a className="audit67__textLink" href="#contato">
                  Fale com nosso time
                </a>
              </div>

              <div className="audit67__heroSignals">
                <span>INDEPENDÊNCIA</span>
                <span>RIGOR TÉCNICO</span>
                <span>VISÃO DE NEGÓCIO</span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="slide-right" delay={0.2}>
            <div className="audit67__intelligence" aria-hidden="true">
              <div className="audit67__panel">
                <div className="audit67__panelTop">
                  <span>Q-MAX / AUDIT INTELLIGENCE</span>
                  <span>01 — 04</span>
                </div>

                <div className="audit67__axis audit67__axis--x" />
                <div className="audit67__axis audit67__axis--y" />

                <div className="audit67__radar">
                  <span className="audit67__ring audit67__ring--1" />
                  <span className="audit67__ring audit67__ring--2" />
                  <span className="audit67__ring audit67__ring--3" />

                  <div className="audit67__logoCore">
                    <Image
                      src="/brands/auditoria-branco.png"
                      alt=""
                      width={300}
                      height={100}
                      priority
                    />
                  </div>

                  <span className="audit67__point audit67__point--1" />
                  <span className="audit67__point audit67__point--2" />
                  <span className="audit67__point audit67__point--3" />
                </div>

                <div className="audit67__panelMetric audit67__panelMetric--left">
                  <small>ANÁLISE</small>
                  <strong>Risco</strong>
                  <span>Processos / controles</span>
                </div>

                <div className="audit67__panelMetric audit67__panelMetric--right">
                  <small>RESULTADO</small>
                  <strong>Clareza</strong>
                  <span>Informação / decisão</span>
                </div>

                <div className="audit67__panelBottom">
                  <span>AUDIT</span>
                  <span>COMPLIANCE</span>
                  <span>GOVERNANCE</span>
                </div>
              </div>

              <div className="audit67__floatingCard">
                <span>Q / 01</span>
                <strong>Informação confiável.</strong>
                <small>Decisões mais consistentes.</small>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <ScrollReveal animation="fade-up">
        <section id="sobre" className="audit67__manifesto">
          <div className="audit67__manifestoIndex">
            <span>01</span>
            <small>SOBRE</small>
          </div>

          <div className="audit67__manifestoCopy">
            <p className="audit67__kicker">ALÉM DA CONFORMIDADE</p>

            <h2>
              Auditoria que transforma
              <br />
              informação em <em>confiança.</em>
            </h2>

            <div className="audit67__manifestoText">
              <p>
                Combinamos rigor técnico, independência e entendimento do negócio
                para analisar informações com profundidade e apoiar organizações
                em decisões cada vez mais consistentes.
              </p>

              <p>
                Mais do que identificar conformidade, buscamos gerar clareza sobre
                processos, controles e informações relevantes para a gestão.
              </p>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section className="audit67__proof">
          <div className="audit67__proofItem">
            <strong>01</strong>
            <span>Rigor técnico</span>
          </div>
          <div className="audit67__proofItem">
            <strong>02</strong>
            <span>Independência</span>
          </div>
          <div className="audit67__proofItem">
            <strong>03</strong>
            <span>Visão estratégica</span>
          </div>
          <div className="audit67__proofItem">
            <strong>04</strong>
            <span>Clareza para decidir</span>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="atuacao" className="audit67__services">
          <div className="audit67__sectionIntro">
            <div>
              <span className="audit67__sectionNumber">02 / ATUAÇÃO</span>
              <h2>
                Clareza em cada
                <br />
                <em>camada do negócio.</em>
              </h2>
            </div>

            <p>
              Especialidades conectadas para compreender riscos, fortalecer
              controles e ampliar a confiança sobre informações essenciais.
            </p>
          </div>

          <div className="audit67__serviceGrid">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article className="audit67__service" key={service.number}>
                  <div className="audit67__serviceTop">
                    <span>{service.number}</span>
                    <Icon size={25} strokeWidth={1.35} />
                  </div>

                  <div>
                    <h3>{service.title}</h3>
                    <p>{service.text}</p>
                  </div>

                  <span className="audit67__serviceArrow">
                    <ArrowRight size={18} />
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section className="audit67__intelligenceLayer">
          <div className="audit67__intelligenceInner">
            <div className="audit67__intelligenceHead">
              <div>
                <span className="audit67__sectionNumber">
                  03 / INTELIGÊNCIA
                </span>

                <h2>
                  Mais do que auditar.
                  <br />
                  <em>Entender para orientar.</em>
                </h2>
              </div>

              <p>
                Uma atuação que conecta rigor técnico, leitura de riscos
                e capacidade de transformar análises em direcionamentos
                relevantes para o negócio.
              </p>
            </div>

            <div className="audit67__intelligenceCards">
              <article className="audit67__intelligenceCard">
                <div className="audit67__intelligenceCardTop">
                  <span>01</span>
                  <ScanSearch size={26} strokeWidth={1.5} />
                </div>

                <div>
                  <small>AUDIT</small>
                  <h3>Rigor para enxergar.</h3>

                  <p>
                    Auditoria estruturada com metodologia, independência
                    e profundidade para avaliar informações, processos
                    e controles.
                  </p>
                </div>

                <div className="audit67__intelligenceTags">
                  <span>Demonstrações</span>
                  <span>Controles</span>
                  <span>Riscos</span>
                </div>
              </article>

              <article className="audit67__intelligenceCard">
                <div className="audit67__intelligenceCardTop">
                  <span>02</span>
                  <Compass size={26} strokeWidth={1.5} />
                </div>

                <div>
                  <small>ADVISORY</small>
                  <h3>Contexto para decidir.</h3>

                  <p>
                    Conhecimento técnico aplicado à interpretação dos
                    riscos e oportunidades para apoiar decisões mais
                    consistentes.
                  </p>
                </div>

                <div className="audit67__intelligenceTags">
                  <span>Compliance</span>
                  <span>Governança</span>
                  <span>Estratégia</span>
                </div>
              </article>

              <article className="audit67__intelligenceCard">
                <div className="audit67__intelligenceCardTop">
                  <span>03</span>
                  <GraduationCap size={26} strokeWidth={1.5} />
                </div>

                <div>
                  <small>CAPACITY</small>
                  <h3>Conhecimento para evoluir.</h3>

                  <p>
                    Diagnóstico das necessidades da organização,
                    identificação de oportunidades de melhoria e
                    desenvolvimento de capacidades internas.
                  </p>
                </div>

                <div className="audit67__intelligenceTags">
                  <span>Processos</span>
                  <span>Pessoas</span>
                  <span>Evolução</span>
                </div>
              </article>
            </div>

            <div className="audit67__scope">
              <span>ESCOPO DE INTELIGÊNCIA</span>

              <div className="audit67__scopeItems">
                <span>Demonstrações contábeis</span>
                <span>Controles internos</span>
                <span>Compliance</span>
                <span>LGPD</span>
                <span>Gestão de riscos</span>
                <span>Governança</span>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="metodo" className="audit67__method">
          <div className="audit67__methodVisual" aria-hidden="true">
            <div className="audit67__methodGrid" />

            <div className="audit67__methodCenter">
              <span className="audit67__methodRing audit67__methodRing--1" />
              <span className="audit67__methodRing audit67__methodRing--2" />

              <Layers3 size={52} strokeWidth={1} />

              <strong>VISÃO INTEGRADA</strong>
              <small>NEGÓCIO / RISCO / CONTROLE</small>
            </div>

            <span className="audit67__coordinate audit67__coordinate--1">
              01 / ANALISAR
            </span>
            <span className="audit67__coordinate audit67__coordinate--2">
              02 / COMPREENDER
            </span>
            <span className="audit67__coordinate audit67__coordinate--3">
              03 / ORIENTAR
            </span>
          </div>

          <div className="audit67__methodCopy">
            <span className="audit67__sectionNumber">03 / COMO ATUAMOS</span>

            <h2>
              Técnica para analisar.
              <br />
              <em>Visão para evoluir.</em>
            </h2>

            <p>
              Nossa abordagem conecta análise técnica ao contexto real da
              organização. O objetivo é transformar complexidade em informação
              útil para quem precisa decidir.
            </p>

            <ul>
              <li>
                <Check size={17} />
                Compreensão do negócio e de seus processos
              </li>
              <li>
                <Check size={17} />
                Avaliação estruturada de riscos e controles
              </li>
              <li>
                <Check size={17} />
                Comunicação objetiva dos pontos relevantes
              </li>
              <li>
                <Check size={17} />
                Recomendações orientadas à consistência e evolução
              </li>
            </ul>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section className="audit67__principles">
          <div className="audit67__principlesHead">
            <span className="audit67__sectionNumber">04 / NOSSA VISÃO</span>
            <h2>
              Confiança é construída
              <br />
              <em>em cada detalhe.</em>
            </h2>
          </div>

          <div className="audit67__principlesGrid">
            {principles.map((principle, index) => {
              const Icon = principle.icon;

              return (
                <article key={principle.title}>
                  <div>
                    <span>0{index + 1}</span>
                    <Icon size={22} strokeWidth={1.4} />
                  </div>
                  <h3>{principle.title}</h3>
                  <p>{principle.text}</p>
                </article>
              );
            })}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal animation="fade-up">
        <section id="contato" className="audit67__contact">
          <div className="audit67__contactGrid">
            <div>
              <span className="audit67__contactIndex">05 / PRÓXIMO PASSO</span>

              <h2>
                Boas decisões começam
                <br />
                com uma <em>boa conversa.</em>
              </h2>
            </div>

            <div className="audit67__contactAction">
              <p>
                Converse com a Q-Max Auditoria sobre os desafios e necessidades
                da sua organização.
              </p>

              <a href="mailto:contato@grupoqmax.com.br">
                Fale com nosso time
                <ArrowRight size={20} />
              </a>
            </div>
          </div>

          <div className="audit67__contactMeta">
            <span><strong className="audit67__eyebrowLabel">Q-MAX AUDITORIA</strong></span>
            <span>INDEPENDÊNCIA / QUALIDADE / CONFIANÇA</span>
          </div>
        </section>
      </ScrollReveal>

      <footer className="finish-footer audit67__finishFooter">
        <div className="container finish-footer__top">
          <div className="finish-footer__brand">
            <Link href="/auditoria" aria-label="Q-Max Auditoria">
              <Image
                src="/brands/auditoria-branco.png"
                alt="Q-Max Auditoria"
                width={180}
                height={56}
                sizes="180px"
                style={{
                  width: "auto",
                  height: "44px",
                }}
              />
            </Link>

            <p>
              Auditoria independente, governança, compliance e controles internos com rigor técnico e visão estratégica.
            </p>

            <div className="finish-footer__quickContact">
              <a
                href="https://wa.me/551128976514"
                target="_blank"
                rel="noopener noreferrer"
                className="finish-footer__quickBtn"
                aria-label="WhatsApp Q-Max Auditoria"
              >
                <span>● WhatsApp: (11) 2897-6514</span>
              </a>
              <a
                href="mailto:contato@grupoqmax.com.br"
                className="finish-footer__quickBtn"
                aria-label="E-mail Q-Max Auditoria"
              >
                <span>contato@grupoqmax.com.br</span>
              </a>
            </div>
          </div>

          <div className="finish-footer__nav">
            <div>
              <strong>NAVEGAÇÃO</strong>

              <a href="#sobre">Sobre</a>
              <a href="#atuacao">Atuação</a>
              <a href="#metodo">Metodologia</a>
              <a href="#contato">Contato</a>
            </div>

            <div>
              <strong>ESPECIALIDADES</strong>

              <a href="#atuacao">Demonstrações Contábeis</a>
              <a href="#atuacao">Controles Internos & Compliance</a>
              <a href="#atuacao">LGPD e DPO</a>
              <a href="#atuacao">Gestão de Riscos</a>
            </div>

            <div>
              <strong>ECOSSISTEMA</strong>

              <Link href="/">
                Grupo Q-Max
              </Link>
              <a href="https://www.grupoqmax.com.br/contabil/index.php" target="_blank" rel="noopener noreferrer">
                Q-Max Contábil
              </a>
              <a href="https://grupoqmax.com.br/talents/" target="_blank" rel="noopener noreferrer">
                Q-Max Talents
              </a>
              <a href="https://www.grupoqmax.com.br/" target="_blank" rel="noopener noreferrer">
                Q-Max Technology
              </a>
              <a href="https://www.grupoqmax.com.br/" target="_blank" rel="noopener noreferrer">
                Lagerhaus
              </a>
            </div>
          </div>
        </div>

        <div className="container finish-footer__bottom">
          <span>© 2026 Q-Max Auditoria · Uma empresa do Grupo Q-Max<span className="qmax-punctuation">.</span></span>

          <div>
            <span>São Bernardo do Campo · SP</span>
            <i />
            <span>Independência, Rigor Técnico e Visão Estratégica.</span>
          </div>
        </div>
      </footer>

      <BackToTop />
    </main>
  );
}
