"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  HeartPulse,
  MousePointerClick,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

const products = [
  {
    id: "qxback",
    number: "01",
    name: "QXBACK",
    label: "INDICAÇÕES & BONIFICAÇÃO",
    color: "#55ff00",
    logo: "/brands/qxback.png",
    icon: MousePointerClick,
    headline: "Indique. Acompanhe. Seja bonificado.",
    description:
      "Programa de bonificação por indicação conectado a serviços contábeis, tributários, fiscais e trabalhistas.",
    benefits: [
      "Cashback por serviços contratados",
      "Bônus por propostas enviadas",
      "Plataforma de gestão de indicações",
      "Ganhos em tempo real",
    ],
    interfaceLabel: "GESTÃO DE INDICAÇÕES",
  },
  {
    id: "qxsign",
    number: "02",
    name: "QXSIGN",
    label: "DOCUMENTAÇÃO DIGITAL",
    color: "#16d2c5",
    logo: "/products/qxsign-dashboard.png",
    icon: FileCheck2,
    headline: "Documentação digital sem complicação.",
    description:
      "Solução do ecossistema Q-Max para apoiar processos de documentação e certificados digitais.",
    benefits: [
      "Atendimento especializado",
      "Suporte em documentação digital",
      "Certificados digitais simplificados",
      "Acesso a sistemas governamentais",
    ],
    interfaceLabel: "DOCUMENTOS DIGITAIS",
  },
  {
    id: "finora",
    number: "03",
    name: "FINORA",
    label: "INTELIGÊNCIA FINANCEIRA",
    color: "#a45cff",
    logo: "/products/finora-dashboard.png",
    icon: HeartPulse,
    headline: "Inteligência financeira para clínicas.",
    description:
      "Gestão contábil e financeira direcionada principalmente a profissionais e clínicas da área da saúde.",
    benefits: [
      "Redução legal de impostos",
      "Gestão contábil e financeira",
      "Regularização documental",
      "Foco em profissionais da saúde",
    ],
    interfaceLabel: "GESTÃO FINANCEIRA",
  },
];

export function Products() {
  const [activeIndex, setActiveIndex] = useState(0);

  const active = products[activeIndex];
  const ActiveIcon = active.icon;

  function next() {
    setActiveIndex((current) => (current + 1) % products.length);
  }

  function previous() {
    setActiveIndex(
      (current) => (current - 1 + products.length) % products.length
    );
  }

  return (
    <section
      id="produtos"
      className="products5"
      style={
        {
          "--product": active.color,
        } as React.CSSProperties
      }
    >
      <div className="products5__ambient" />
      <div className="products5__lines" />

      <div className="container products5__container">
        <header className="products5__header">
          <div>
            <span className="eyebrow">
              <Sparkles size={13} />
              PRODUTOS Q-MAX
            </span>

            <h2>
              Tecnologia aplicada
              <br />
              a <em>desafios reais.</em>
            </h2>
          </div>

          <p>
            Produtos digitais criados para simplificar processos, conectar
            informações e apoiar resultados em diferentes contextos de negócio.
          </p>
        </header>

        <div className="products5__navigation">
          {products.map((product, index) => (
            <button
              type="button"
              key={product.id}
              onClick={() => setActiveIndex(index)}
              className={activeIndex === index ? "active" : ""}
              style={
                {
                  "--tab": product.color,
                } as React.CSSProperties
              }
            >
              <span>{product.number}</span>

              <div>
                <strong>{product.name}</strong>
                <small>{product.label}</small>
              </div>

              <i />
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            className="products5__stage"
            initial={{
              opacity: 0,
              y: 28,
              filter: "blur(10px)",
            }}
            animate={{
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
            }}
            exit={{
              opacity: 0,
              y: -16,
              filter: "blur(7px)",
            }}
            transition={{
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="products21__watermark" aria-hidden="true">
              {active.name}
            </span>

            <div className="products21__status" aria-hidden="true">
              <i />
              <span>{active.number} / 0{products.length}</span>
            </div>

            <div className="products5__copy">
              <div className="products5__productMeta">
                <ActiveIcon size={18} />
                <span>{active.label}</span>
              </div>

              <div className="products5__brand">
                {active.logo ? (
                  <img
                    src={active.logo}
                    alt={active.name}
                    className="products36__image"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <strong>{active.name}</strong>
                )}
              </div>

              <h3>{active.headline}</h3>

              <p>{active.description}</p>

              <div className="products5__benefits">
                {active.benefits.map((benefit) => (
                  <div key={benefit}>
                    <span>
                      <Check size={12} />
                    </span>

                    <strong>{benefit}</strong>
                  </div>
                ))}
              </div>

              <a href="#contato">
                Quero conhecer {active.name}
                <ArrowUpRight size={17} />
              </a>
            </div>

            <div className="products5__visual">
              <div className="products5__orbit orbit-a" />
              <div className="products5__orbit orbit-b" />
              <div className="products5__orbit orbit-c" />

              <div className="products5__floating products5__floating--top">
                <span>PRODUTO Q-MAX</span>
                <strong>{active.interfaceLabel}</strong>
              </div>

              <motion.div
                className="products5__device"
                animate={{
                  y: [0, -9, 0],
                  rotateY: [-3, 2, -3],
                  rotateX: [1, -1, 1],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <div className="products5__deviceTop">
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>

                  <span>{active.name}</span>
                </div>

                <div className="products5__deviceBody">
                  <aside>
                    <div className="products5__sidebarLogo">
                      <ActiveIcon size={18} />
                    </div>

                    <i />
                    <i />
                    <i />
                    <i />
                  </aside>

                  <div className="products5__dashboard">
                    <header>
                      <div>
                        <small>{active.interfaceLabel}</small>
                        <strong>{active.name}</strong>
                      </div>

                      <span>● ATIVO</span>
                    </header>

                    <div className="products5__metricGrid">
                      <article>
                        <small>Experiência</small>
                        <strong>Digital</strong>
                      </article>

                      <article>
                        <small>Operação</small>
                        <strong>Integrada</strong>
                      </article>

                      <article>
                        <small>Ecossistema</small>
                        <strong>Q-Max</strong>
                      </article>
                    </div>

                    <div className="products5__chart">
                      {[31, 48, 40, 66, 54, 78, 69, 91].map(
                        (height, index) => (
                          <span
                            key={index}
                            style={{
                              height: `${height}%`,
                            }}
                          />
                        )
                      )}
                    </div>

                    <div className="products5__data">
                      <div>
                        <i />
                        <span />
                        <b />
                      </div>

                      <div>
                        <i />
                        <span />
                        <b />
                      </div>

                      <div>
                        <i />
                        <span />
                        <b />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="products5__floating products5__floating--bottom">
                <ActiveIcon size={16} />
                <span>{active.name}</span>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <footer className="products5__footer">
          <div className="products5__counter">
            <strong>0{activeIndex + 1}</strong>

            <div>
              {products.map((product, index) => (
                <button
                  type="button"
                  key={product.id}
                  aria-label={product.name}
                  className={activeIndex === index ? "active" : ""}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>

            <span>0{products.length}</span>
          </div>

          <div className="products5__controls">
            <button
              type="button"
              onClick={previous}
              aria-label="Produto anterior"
            >
              <ChevronLeft size={19} />
            </button>

            <button
              type="button"
              onClick={next}
              aria-label="Próximo produto"
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}