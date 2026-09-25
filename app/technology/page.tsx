import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, PlaySquare } from "lucide-react";


import { ScrollReveal } from "@/components/ScrollReveal";
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

export default function TechnologyPage() {
  return (
    <main className="technology-page">
      {/* HERO SECTION - VÍDEO */}
      <ScrollReveal animation="fade-up">
        <section className="tech-hero">
          <div className="tech-hero__video-wrapper">
            <div className="tech-hero__video-bg">
              <div className="tech-hero__grid-pattern" />
              <div className="tech-hero__glow-orb" />
              <div className="tech-hero__glow-orb tech-hero__glow-orb--2" />
            </div>
            
            <div className="tech-hero__video-content">
              <span>EXPLORE A NOSSA VISÃO</span>
              <p>Inovação, Código e Performance em um só lugar.</p>
              
              {/* Glassmorphic Terminal Window */}
              <div className="tech-hero__terminal">
                <div className="tech-hero__terminal-header">
                  <span className="dot dot-red"></span>
                  <span className="dot dot-yellow"></span>
                  <span className="dot dot-green"></span>
                </div>
                <div className="tech-hero__terminal-body">
                  <p><code><span className="text-blue">const</span> qmax <span className="text-blue">=</span> <span className="text-yellow">new</span> <span className="text-green">Technology</span>();</code></p>
                  <p><code>qmax.<span className="text-yellow">innovate</span>(<span className="text-orange">"Future"</span>);</code></p>
                  <p className="terminal-cursor"><code>&gt; System Ready_</code></p>
                </div>
              </div>
            </div>

            <div className="tech-hero__icon-circle">
              <PlaySquare size={24} fill="currentColor" strokeWidth={0} />
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* INTRO SECTION */}
      <ScrollReveal animation="fade-up" delay={0.1}>
        <section className="tech-intro">
          <h2>Uma nova <em>era</em> para sua marca.</h2>
          <p>
            Somos uma empresa movida por <strong>inovação</strong>, <strong>tecnologia</strong> e <strong>desenvolvimento</strong> de soluções digitais.
          </p>
          <p>
            Criamos sistemas personalizados que transformam ideias em experiências digitais eficientes, ajudando empresas a crescer, inovar e se destacar em um mercado cada vez mais conectado.
          </p>
        </section>
      </ScrollReveal>

      {/* PROJECTS SECTION */}
      <ScrollReveal animation="fade-up" delay={0.2}>
        <section className="tech-projects">
          <h3>Conheça nossos projetos</h3>
          <div className="tech-projects__grid">
            <div className="tech-projects__item">
              <Image 
                src="/technology/project-1.png" 
                alt="Projeto FK Contabilidade" 
                width={500} 
                height={300} 
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
            <div className="tech-projects__item">
              <Image 
                src="/technology/project-2.png" 
                alt="Projeto Zuri" 
                width={500} 
                height={300} 
                style={{ width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* SERVICES SECTION */}
      <ScrollReveal animation="slide-left" delay={0.1}>
        <section className="tech-services">
          <div className="tech-services__header">
            <div className="tech-services__line" />
            <h2>NOSSOS SERVIÇOS</h2>
            <p>Somos capazes de fornecer suporte <em>completo</em> à sua marca!</p>
          </div>

          <div className="tech-services__grid">
            <article className="tech-card">
              <div className="tech-card__top">
                <div className="tech-card__toggle" />
              </div>
              <h4>GESTÃO DE<br />MÍDIAS</h4>
              <p>Estratégias completas para suas redes sociais, fortalecendo sua marca, aumentando engajamento e ampliando sua presença online.</p>
              <div className="tech-card__arrow">
                <ArrowUpRight size={20} strokeWidth={3} />
              </div>
            </article>

            <article className="tech-card">
              <div className="tech-card__top">
                <div className="tech-card__toggle" />
              </div>
              <h4>SOLUÇÕES<br />WEB</h4>
              <p>Criamos sites profissionais, responsivos e otimizados, que representam sua marca e geram credibilidade para o seu negócio.</p>
              <div className="tech-card__arrow">
                <ArrowUpRight size={20} strokeWidth={3} />
              </div>
            </article>

            <article className="tech-card">
              <div className="tech-card__top">
                <div className="tech-card__toggle" />
              </div>
              <h4>MARKETING<br />DIGITAL</h4>
              <p>Atraímos, engajamos e convertemos o público online em clientes. Mais visibilidade, resultados e crescimento para sua empresa.</p>
              <div className="tech-card__arrow">
                <ArrowUpRight size={20} strokeWidth={3} />
              </div>
            </article>

            <article className="tech-card">
              <div className="tech-card__top">
                <div className="tech-card__toggle" />
              </div>
              <h4>INTEGRAÇÕES<br />BITRIX</h4>
              <p>Maximize seu potencial com integrações inteligentes do Bitrix24. Automatizamos processos e conectamos ferramentas para mais eficiência e produtividade.</p>
              <div className="tech-card__arrow">
                <ArrowUpRight size={20} strokeWidth={3} />
              </div>
            </article>
          </div>
        </section>
      </ScrollReveal>

      {/* CTA SECTION */}
      <ScrollReveal animation="fade-up" delay={0.1}>
        <section className="tech-cta">
          <div className="tech-cta__content">
            <h2>
              TECNOLOGIA QUE IMPULSIONA<br />
              <span>RESULTADOS</span> E ACELERA O<br />
              CRESCIMENTO DO SEU <span>NEGÓCIO</span>
            </h2>
            <div className="tech-cta__line" />
            <p>
              Desenvolvimento de sistemas, automações, integrações e soluções digitais criadas para aumentar a eficiência e gerar mais oportunidades para sua empresa.
            </p>
          </div>
          
          <Image 
            src="/technology/shape-2.png" 
            alt="Decoração" 
            width={400} 
            height={400} 
            className="tech-cta__shape"
          />
        </section>
      </ScrollReveal>

      
      
    </main>
  );
}
