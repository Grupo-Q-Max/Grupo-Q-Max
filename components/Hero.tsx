"use client";

import Image from "next/image";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { ArrowDown, ArrowRight, Sparkles } from "lucide-react";
import type { MouseEvent } from "react";

export function Hero() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(mouseY, { stiffness: 80, damping: 16 });
  const rotateY = useSpring(mouseX, { stiffness: 80, damping: 16 });

  function move(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(((event.clientX - rect.left) / rect.width - 0.5) * 10);
    mouseY.set(((event.clientY - rect.top) / rect.height - 0.5) * -8);
  }

  function reset() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <section
      id="inicio"
      className="hero hero21"
      onMouseMove={move}
      onMouseLeave={reset}
    >
      <div className="hero__aurora" />
      <div className="hero21__monogram" aria-hidden="true">Q</div>
      <div className="hero21__axis" aria-hidden="true" />

      <div className="container hero__grid">
        <motion.div
          className="hero__copy"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="eyebrow">
            <Sparkles size={14} />
            ECOSSISTEMA EMPRESARIAL Q-MAX
          </span>

          <h1>
            Tecnologia,
            <br />
            <em>Inovação,</em>
            <br />
            Atitude.
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
              Conheça o Grupo Q-Max
            </a>
          </div>

          <div className="hero21__signature" aria-hidden="true">
            <span>Q-MAX</span>
            <i />
            <small>QUALIDADE / QUALIFICAÇÃO / INOVAÇÃO</small>
          </div>
        </motion.div>

        <div className="hero__visualWrap">
          <motion.div
            className="hero__visual"
            style={{ rotateX, rotateY }}
          >
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
              <b>05</b>
              <span>empresas conectadas</span>
            </div>

            <div className="hero__badge hero__badge--b">
              <b>03</b>
              <span>produtos em destaque</span>
            </div>

            <div className="hero__badge hero__badge--c">
              <b>Q</b>
              <span>inovação com propósito</span>
            </div>
          </motion.div>
        </div>
      </div>

      <a className="hero__scroll" href="#sobre">
        <ArrowDown size={16} />
        Descubra como tudo se conecta
      </a>
    </section>
  );
}
