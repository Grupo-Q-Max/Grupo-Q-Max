import type { Metadata } from "next";
import Image from "next/image";
import { ArrowUpRight, Share2, Globe, TrendingUp, Layers, PenTool, MonitorSmartphone, Code, Cpu, Database, Shield, Zap, Sparkles, Server } from "lucide-react";

import { ScrollReveal } from "@/components/ScrollReveal";
import { TechPreloader } from "@/components/TechPreloader";
import { TechCustomCursor } from "@/components/TechCustomCursor";
import { TechMarquee } from "@/components/TechMarquee";
import { TiltWrapper } from "@/components/TiltWrapper";
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
    siteName: "Grupo Q-Max",
    images: [
      {
        url: "/brands/qmax-technology-white.png",
        width: 1200,
        height: 630,
        alt: "Q-Max Technology",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Q-Max Technology | Digital & Inovação com Propósito",
    description: "Soluções digitais inteligentes e ferramentas sob medida pelo Grupo Q-Max.",
    images: ["/brands/qmax-technology-white.png"],
  },
};

const WHATSAPP_URL = "https://wa.me/551128976514";

const whatsappLink = (message: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;

const services = [
  {
    name: "Sites e Landing Pages",
    title: ["SITES E", "LANDING PAGES"],
    description:
      "Criamos sites profissionais, responsivos e otimizados focados em conversão, gerando credibilidade e mais vendas para o seu negócio.",
    Icon: Globe,
  },
  {
    name: "Bitrix e outros CRMs",
    title: ["BITRIX E", "OUTROS CRMs"],
    description:
      "Maximize seu potencial com integrações inteligentes e automações. Conectamos ferramentas para garantir a máxima eficiência da equipe.",
    Icon: Layers,
  },
  {
    name: "Marketing Digital",
    title: ["MARKETING", "DIGITAL"],
    description:
      "Atraímos, engajamos e convertemos o público online em clientes. Estratégias completas para mais visibilidade e crescimento.",
    Icon: TrendingUp,
  },
  {
    name: "Gestão de Mídias",
    title: ["GESTÃO DE", "MÍDIAS"],
    description:
      "Estratégias completas de postagens e gestão de redes sociais, fortalecendo sua marca, aumentando engajamento e presença online.",
    Icon: Share2,
  },
  {
    name: "Identidade Visual",
    title: ["IDENTIDADE", "VISUAL"],
    description:
      "Construímos marcas fortes e memoráveis. Design moderno que transmite os valores e o propósito real da sua empresa para o mercado.",
    Icon: PenTool,
  },
  {
    name: "Sistemas sob Medida",
    title: ["SISTEMAS", "SOB MEDIDA"],
    description:
      "Desenvolvimento de plataformas web exclusivas para resolver os gargalos da sua operação e escalar a sua capacidade de atendimento.",
    Icon: MonitorSmartphone,
  },
];

export default function TechnologyPage() {
  return (
    <main className="technology-page">
      <TechPreloader />

      {/* HERO SECTION - VÍDEO */}
      {/* Not inside ScrollReveal: this is the LCP image, it must show without waiting for JS */}
      <section className="tech-hero">
        <div className="tech-hero__video-wrapper">
          <Image 
            src="/technology/futuristic-hero.jpg"
            alt="Futuristic Digital Landscape"
            fill
            className="tech-hero__bg-image"
            priority
            style={{ objectFit: 'cover' }}
          />
          <div className="tech-hero__overlay" />
          
          <div className="tech-hero__orb tech-hero__orb--1"></div>
          <div className="tech-hero__orb tech-hero__orb--2"></div>
          <div className="tech-hero__orb tech-hero__orb--3"></div>
          
          <div className="tech-hero__content">
            <h1 className="tech-hero__title">
              CONSTRUINDO O <span className="text-glow-tech">FUTURO DIGITAL</span> <br />
              DA SUA EMPRESA.
            </h1>
            <p className="tech-hero__subtitle">
              Estratégias avançadas, automações e desenvolvimento de alto desempenho para marcas que exigem o melhor.
            </p>
          </div>
        </div>
      </section>

      {/* INTRO SECTION */}
      <ScrollReveal animation="fade-up" delay={0.1}>
        <section className="tech-intro">
          <div className="tech-intro__floating-icons">
            <Cpu size={48} className="float-icon float-icon--1" />
            <Database size={40} className="float-icon float-icon--2" />
            <Code size={56} className="float-icon float-icon--3" />
          </div>
          <h2>Uma nova <em>era</em> para sua marca.</h2>
          <p>
            Somos uma equipe apaixonada por <strong>estratégias criativas</strong> e resultados excepcionais. Oferecemos soluções personalizadas para ajudar sua marca a se destacar no mercado.
          </p>
          <p>
            Criamos sistemas personalizados que transformam ideias em experiências digitais eficientes, ajudando empresas a crescer, inovar e se destacar em um mercado cada vez mais conectado.
          </p>
        </section>
      </ScrollReveal>

      {/* BIG TYPOGRAPHY SECTION */}
      <ScrollReveal animation="fade-up" delay={0.2}>
        <section className="tech-big-text">
          <div className="tech-big-text__wrapper">
            <div className="tech-big-text__content">
              <div className="tech-badge-animated">
                <Zap size={16} className="tech-badge-icon" /> <span>ALTA PERFORMANCE</span>
              </div>
              <h2>
                DÊ UM "Q" DE <br />
                <span className="text-glow-blue">INOVAÇÃO</span><br />
                <span className="text-glow-blue">TECNOLOGIA</span><br />
                & CRIATIVIDADE
              </h2>
              <p>
                Acreditamos que o marketing e a tecnologia vão além de campanhas e códigos; é uma jornada para construir conexões significativas com o seu público. Nossa equipe é composta por profissionais experientes unidos por uma visão comum: impulsionar o crescimento dos nossos clientes.
              </p>
            </div>
            
            <div className="tech-big-text__code">
              <div className="tech-hero__code-window">
                <div className="tech-hero__code-header">
                  <div className="tech-hero__code-dots">
                    <span className="dot dot-red"></span>
                    <span className="dot dot-yellow"></span>
                    <span className="dot dot-green"></span>
                  </div>
                  <div className="tech-hero__code-title">Q-Max_Core.ts</div>
                </div>
                <div className="tech-hero__code-body">
                  <p><code><span className="code-keyword">import</span> &#123; Innovation, Performance &#125; <span className="code-keyword">from</span> <span className="code-string">'@qmax/core'</span>;</code></p>
                  <p><br/></p>
                  <p><code><span className="code-keyword">async function</span> <span className="code-function">initializeBrand</span>(brandName: <span className="code-type">string</span>) &#123;</code></p>
                  <p><code>&nbsp;&nbsp;<span className="code-keyword">const</span> strategy = <span className="code-keyword">await</span> Innovation.<span className="code-function">generate</span>();</code></p>
                  <p><code>&nbsp;&nbsp;<span className="code-keyword">const</span> result = Performance.<span className="code-function">maximize</span>(strategy);</code></p>
                  <p><code>&nbsp;&nbsp;</code></p>
                  <p><code>&nbsp;&nbsp;<span className="code-keyword">return</span> <span className="code-string">`Sucesso absoluto para $&#123;brandName&#125;!`</span>;</code></p>
                  <p><code>&#125;</code></p>
                  <p><br/></p>
                  <p><code><span className="code-comment">// Inicializando sistema...</span></code></p>
                  <p className="code-typing"><code><span className="code-function">initializeBrand</span>(<span className="code-string">'Sua Empresa'</span>);<span className="code-cursor"></span></code></p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* PRODUCTS SECTION */}
      <ScrollReveal animation="fade-up" delay={0.2}>
        <section className="tech-products">
          <div className="tech-products__header">
            <div className="tech-header-icon-wrap"><Server size={32} className="tech-header-icon" /></div>
            <h3>Nossos Produtos</h3>
            <p>Ecosistema de inovação construído para o seu negócio</p>
          </div>
          <div className="tech-products__grid">
            <a href="https://qxback.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <TiltWrapper className="tech-product-card">
                <div className="tech-product-card__glow"></div>
                <div className="tech-product-card__content">
                  <div className="nav15__brandThumb nav15__brandThumb--qxback" style={{ marginBottom: '24px' }}>
                    <Image
                      src="/brands/qxback.png"
                      alt="QXBACK"
                      width={100}
                      height={52}
                    />
                  </div>
                  <h4>QXBack</h4>
                  <p>Programa de bonificação inteligente.</p>
                  <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
                </div>
              </TiltWrapper>
            </a>
            
            <a href="https://qxsign.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <TiltWrapper className="tech-product-card">
                <div className="tech-product-card__glow"></div>
                <div className="tech-product-card__content">
                  <div className="nav15__brandThumb nav15__brandThumb--qxsign" style={{ marginBottom: '24px' }}>
                    <strong className="nav15__qxsignMark">
                      QX<span>SIGN</span>
                    </strong>
                  </div>
                  <h4>QXSign</h4>
                  <p>Certificados digitais e assinaturas seguras.</p>
                  <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
                </div>
              </TiltWrapper>
            </a>
            
            <TiltWrapper className="tech-product-card">
              <div className="tech-product-card__glow"></div>
              <div className="tech-product-card__content">
                <div style={{ marginBottom: '24px', height: '58px', display: 'flex', alignItems: 'center' }}>
                  <Image
                    src="/brands/finora-logo-horizontal.png"
                    alt="FINORA"
                    width={150}
                    height={52}
                    style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <h4>Finora</h4>
                <p>Otimização fiscal e gestão para dentistas.</p>
                <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
              </div>
            </TiltWrapper>
          </div>
        </section>
      </ScrollReveal>

      {/* PARTNERS SECTION */}
      <ScrollReveal animation="fade-up" delay={0.3}>
        <section className="tech-partners">
          <div className="tech-partners__header">
            <div className="tech-header-icon-wrap"><Shield size={32} className="tech-header-icon" /></div>
            <h3>Nossos Parceiros & Projetos</h3>
            <div className="tech-partners__line"></div>
          </div>
          <div className="tech-partners__grid" style={{ gap: '30px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://fattork.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <TiltWrapper className="tech-product-card">
                <div className="tech-product-card__glow"></div>
                <div className="tech-product-card__content">
                <div style={{ marginBottom: '24px', height: '58px', display: 'flex', alignItems: 'center' }}>
                  <Image 
                    src="/technology/logo-fattork-horizontal.svg" 
                    alt="Fattork" 
                    width={150} 
                    height={52} 
                    style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <h4>Fattork</h4>
                <p>Soluções ágeis em gestão e contabilidade digital.</p>
                <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
                </div>
              </TiltWrapper>
            </a>
            
            <a href="https://kernit.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <TiltWrapper className="tech-product-card">
                <div className="tech-product-card__glow"></div>
                <div className="tech-product-card__content">
                <div style={{ marginBottom: '24px', height: '58px', display: 'flex', alignItems: 'center' }}>
                  <Image 
                    src="/technology/logo-kernit.png" 
                    alt="Kernit" 
                    width={150} 
                    height={52} 
                    style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <h4>Kernit</h4>
                <p>Equipamentos de alta precisão e mecatrônica.</p>
                <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
                </div>
              </TiltWrapper>
            </a>
            
            <a href="https://livital.com.br" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <TiltWrapper className="tech-product-card">
                <div className="tech-product-card__glow"></div>
                <div className="tech-product-card__content">
                <div style={{ marginBottom: '24px', height: '58px', display: 'flex', alignItems: 'center' }}>
                  <Image 
                    src="/technology/logo-livital-white.webp" 
                    alt="Livital" 
                    width={150} 
                    height={52} 
                    style={{ width: 'auto', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <h4>Livital</h4>
                <p>Especialidades químicas e de performance industrial.</p>
                <div className="tech-product-card__arrow"><ArrowUpRight size={18} /></div>
                </div>
              </TiltWrapper>
            </a>
          </div>
        </section>
      </ScrollReveal>

      {/* TECH MARQUEE */}
      <TechMarquee />

      {/* SERVICES SECTION */}
      <ScrollReveal animation="slide-left" delay={0.1}>
        <section className="tech-services">
          <div className="tech-services__header">
            <div className="tech-services__line" />
            <h2>NOSSOS SERVIÇOS</h2>
            <p>Somos capazes de fornecer suporte <em>completo</em> à sua marca!</p>
          </div>

          <div className="tech-services__grid">
            {services.map(({ name, title, description, Icon }) => (
              <a
                key={name}
                className="tech-services__link"
                href={whatsappLink(
                  `Olá! Tenho interesse em ${name} da Q-Max Technology.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${name}: falar com a Q-Max Technology pelo WhatsApp`}
              >
                <TiltWrapper className="tech-card">
                  <div className="tech-card__icon-wrap">
                    <Icon size={32} className="tech-card__icon" />
                  </div>
                  <div className="tech-card__content">
                    <h4>
                      {title[0]}
                      <br />
                      {title[1]}
                    </h4>
                    <p>{description}</p>
                  </div>
                  <div className="tech-card__arrow" aria-hidden="true">
                    <ArrowUpRight size={20} strokeWidth={3} />
                  </div>
                </TiltWrapper>
              </a>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* CTA SECTION */}
      <ScrollReveal animation="fade-up" delay={0.1}>
        <section className="tech-cta">
          <div className="tech-cta__bg-glow"></div>
          
          <div className="tech-cta__wrapper">
            <div className="tech-cta__content">
              <h2>
                Tecnologia que impulsiona <br />
                <span className="tech-cta__highlight">resultados</span> e acelera o <br />
                crescimento do seu <span className="tech-cta__highlight">negócio.</span>
              </h2>
              
              <div className="tech-cta__line" />
              
              <p>
                Desenvolvimento de sistemas, automações, integrações e soluções digitais 
                criadas sob medida para aumentar a eficiência e multiplicar as oportunidades 
                da sua empresa no ambiente digital.
              </p>

              <a
                className="tech-cta__button"
                href={whatsappLink(
                  "Olá! Gostaria de conversar com um especialista da Q-Max Technology."
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                Falar com um especialista
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </a>
              
              <div className="tech-cta__footer">
                <div className="tech-cta__badge"><Sparkles size={16} className="tech-cta-sparkle" /> COMPROMISSO QMAX</div>
                <h3 className="tech-cta__subtitle">
                  Quem cria com propósito, entrega resultados de verdade.
                </h3>
              </div>
            </div>
            
            <div className="tech-cta__visual">
               <Image 
                  src="/technology/shape-2.png" 
                  alt=""
                  aria-hidden="true"
                  fill
                  style={{ objectFit: 'contain', objectPosition: 'center', opacity: 0.9, filter: 'drop-shadow(0 0 40px rgba(11,21,217,0.3))' }}
               />
            </div>
          </div>
        </section>
      </ScrollReveal>

      
      
    </main>
  );
}
