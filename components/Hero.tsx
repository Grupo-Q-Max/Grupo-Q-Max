import { QmaxInline } from "@/components/QmaxBrandText";
import { CountUp } from "@/components/CountUp";
import Image from "next/image";
import { ArrowDown, ArrowRight, Building2, Sparkles, Users, Users2 } from "lucide-react";
export function Hero() {

  return (
    <section
      id="inicio"
      className="hero hero21"
    >
      <div className="hero__aurora" />
      <div className="hero21__monogram" aria-hidden="true">Q</div>
      <div className="hero21__axis" aria-hidden="true" />

      <div className="container hero__grid">
        <div className="hero__copy">
          <span className="eyebrow">
            <Sparkles size={14} />
            ECOSSISTEMA EMPRESARIAL <QmaxInline>Q-MAX</QmaxInline>
          </span>

          <h1>
            Tecnologia<span className="qmax-hero-punctuation qmax-hero-punctuation--magenta">,</span>
            <br />
            <em>Inovação<span className="qmax-hero-punctuation qmax-hero-punctuation--white">,</span></em>
            <br />
            Atitude<span className="qmax-hero-punctuation qmax-hero-punctuation--magenta">.</span>
          </h1>

          <p>
            Qualidade, qualificação e um “Q” de inovação. Um ecossistema
            empresarial sustentável que reúne empresas e profissionais para
            criar soluções inovadoras e impactantes.
          </p>

          <div className="hero__actions">
            <a href="#empresas" className="button button--primary">
              Explorar o ecossistema
              <ArrowRight size={17} />
            </a>

            <a href="#sobre" className="button button--ghost">
              Conheça o Grupo <QmaxInline>Q-Max</QmaxInline>
            </a>
          </div>

          <div className="hero21__signature" aria-hidden="true">
            <span><QmaxInline>Q-MAX</QmaxInline></span>
            <i />
            <small>QUALIDADE / QUALIFICAÇÃO / INOVAÇÃO</small>
          </div>
        </div>

        <div className="hero__visualWrap">
          <div className="hero__visual">
            <div className="hero__rings">
              <i />
              <i />
              <i />
            </div>

            <div className="hero21__scan" aria-hidden="true" />

            <Image
              src="/brands/grupo-qmax-white.png"
              alt="Grupo Q-Max"
              width={780}
              height={520}
              className="hero__logo"
              priority
            />

            <div className="hero__badge hero__badge--a">
              <div className="hero__badgeIcon hero__badgeIcon--cyan">
                <Users size={16} />
              </div>
              <div className="hero__badgeText">
                <b>
                  <CountUp end={400} prefix="+" duration={1800} />
                </b>
                <span>clientes atendidos</span>
              </div>
            </div>

            <div className="hero__badge hero__badge--b">
              <div className="hero__badgeIcon hero__badgeIcon--magenta">
                <Users2 size={16} />
              </div>
              <div className="hero__badgeText">
                <b>
                  <CountUp end={32} duration={1500} />
                </b>
                <span>colaboradores</span>
              </div>
            </div>

            <div className="hero__badge hero__badge--c">
              <div className="hero__badgeIcon hero__badgeIcon--violet">
                <Building2 size={16} />
              </div>
              <div className="hero__badgeText">
                <b>
                  <CountUp end={5} prefix="0" duration={1200} />
                </b>
                <span>empresas conectadas</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <a className="hero__scroll" href="#sobre">
        <ArrowDown size={16} />
        Descubra como tudo se conecta
      </a>
    </section>
  );
}
