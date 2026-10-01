import type { Metadata } from "next";
import Image from "next/image";

import { ScrollReveal } from "@/components/ScrollReveal";
import { FinoraHeader } from "@/components/FinoraHeader";
import { FinoraFooter } from "@/components/FinoraFooter";
import { FinoraFaq, RotatingHeadline, TestimonialCardArt } from "@/components/FinoraInteractive";
import "./finora.css";

export const metadata: Metadata = {
  title: "FINORA | Gestão Financeira & Planejamento para Clínicas Odontológicas",
  description:
    "Inteligência financeira, planejamento tributário e gestão para dentistas e clínicas odontológicas. Economize até 70% nos impostos de forma legal.",
  alternates: {
    canonical: "/finora",
  },
  openGraph: {
    title: "FINORA | Inteligência financeira para o crescimento da sua clínica",
    description:
      "Solução do Grupo Q-Max especializada em planejamento tributário e gestão para dentistas e clínicas odontológicas.",
    url: "/finora",
    type: "website",
  },
};

const WHATSAPP_URL = "https://wa.me/551128976514";

const whatsappLink = (message: string) =>
  `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;

const findings = [
  (
    <>
      O melhor <strong>regime<br />tributário</strong> para o seu<br />faturamento
    </>
  ),
  (
    <>
      Deduções e benefícios fiscais que você <strong>não</strong> está utilizando
    </>
  ),
  (
    <>
      Estratégias <strong>legais</strong>
      <br />para <strong>reduzir</strong> a carga
      <br />tributária
    </>
  ),
];

const plans = [
  {
    title: "Diagnóstico Financeiro",
    icon: "/finora/icon-diagnostico.png",
    iconSize: [94, 88],
    titleWidth: 336,
    items: [] as string[],
  },
  {
    title: "Gestão Financeira",
    icon: "/finora/icon-gestao-financeira.png",
    iconSize: [109, 107],
    titleWidth: 304,
    items: [] as string[],
  },
  {
    title: "Gestão Empresarial",
    icon: "/finora/icon-gestao-empresarial.png",
    iconSize: [99, 98],
    titleWidth: 336,
    items: ["Gestão Financeira e Administrativa Completa"],
  },
];

const testimonials = [
  { name: "Nome cliente", text: "Descrição", location: "Cidade - Estado" },
  { name: "Nome cliente", text: "Descrição", location: "Cidade - Estado" },
  { name: "Nome cliente", text: "Descrição", location: "Cidade - Estado" },
];

const faqs = [
  {
    question: "Como a FINORA reduz impostos da minha clínica?",
    answer:
      "Analisamos o faturamento e a estrutura da clínica para aplicar estratégias legais — como a escolha do regime tributário ideal, equiparação hospitalar e segregação de receitas — que podem reduzir significativamente a carga tributária.",
  },
  {
    question: "Qual o melhor regime tributário para dentistas?",
    answer:
      "Depende do faturamento, da folha de pagamento e dos procedimentos realizados. Comparamos Simples Nacional, Lucro Presumido e outras alternativas para indicar o enquadramento mais vantajoso para o seu caso.",
  },
  {
    question: "Atendo como pessoa física. A FINORA também pode me ajudar?",
    answer:
      "Sim. Avaliamos o uso do Livro Caixa e das deduções permitidas e, quando faz sentido, orientamos a abertura de um CNPJ para reduzir os impostos de forma segura.",
  },
  {
    question: "Como funciona o diagnóstico financeiro?",
    answer:
      "Reunimos as informações fiscais e financeiras da clínica, identificamos oportunidades de economia e apresentamos um plano de ação claro, com os próximos passos e a economia estimada.",
  },
];

export default function FinoraPage() {
  return (
    <main className="fnr">
      <FinoraHeader
        contactHref={whatsappLink("Olá! Tenho uma clínica odontológica e gostaria de falar com a FINORA.")}
      />

      {/* HERO */}
      <section id="inicio" className="fnr-hero">
        <Image
          src="/finora/ativo-10.png"
          alt=""
          width={857}
          height={554}
          className="fnr-hero__decor"
          aria-hidden
        />

        <ScrollReveal animation="fade-up">
          <h1 className="fnr-hero__title">
            Inteligência financeira para o
            <RotatingHeadline />
          </h1>
        </ScrollReveal>

        <div className="fnr-hero__media">
          <Image
            className="fnr-hero__mediaImg"
            src="/finora/hero-media.png"
            alt="Vídeo de apresentação da FINORA"
            width={1800}
            height={1384}
            priority
          />
        </div>
      </section>

      {/* GERENCIAMENTO PARA DENTISTAS */}
      <section id="sobre" className="fnr-intro">
        <ScrollReveal animation="fade-up">
          <h2 className="fnr-ruled fnr-ruled--solid">
            Gerenciamento eficiente para <span>dentistas</span>
          </h2>
          <p>
            Muitos dentistas pagam mais impostos do que o necessário por falta de orientação
            especializada. Escolher o regime tributário errado ou deixar de aproveitar deduções
            legais pode estar reduzindo drasticamente sua lucratividade.
          </p>
        </ScrollReveal>
      </section>

      {/* PLANEJAMENTO TRIBUTÁRIO */}
      <div className="fnr-band-wrap">
        <ScrollReveal animation="zoom-in">
          <section className="fnr-band">
            <Image
              src="/finora/ativo-10.png"
              alt=""
              width={857}
              height={554}
              className="fnr-band__decor"
              aria-hidden
            />
            <Image
              src="/finora/band-shape.svg"
              alt=""
              width={634}
              height={639}
              className="fnr-band__shape"
              aria-hidden
            />

            <h2 className="fnr-band__title">
              Com o planejamento tributário <mark>certo</mark>, é possível{" "}
              <mark>economizar</mark> até 70% nos impostos.
            </h2>

            <Image
              src="/finora/band-line.svg"
              alt=""
              width={966}
              height={1}
              className="fnr-band__line"
              aria-hidden
            />

            <p className="fnr-band__text">
              Seja optando pelo Simples Nacional, Lucro Presumido ou outras estratégias fiscais
              seguras.
            </p>
          </section>
        </ScrollReveal>
      </div>

      {/* O QUE IDENTIFICAMOS */}
      <section className="fnr-analysis">
        <ScrollReveal animation="fade-up">
          <h2 className="fnr-ruled fnr-ruled--dashed">O que identificamos na Análise?</h2>
        </ScrollReveal>

        <div className="fnr-analysis__grid">
          {findings.map((finding, index) => (
            <ScrollReveal key={index} animation="fade-up" delay={index * 0.1}>
              <article className="fnr-finding">
                <p>{finding}</p>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* SEÇÃO CLARA */}
      <div className="fnr-light">
        {/* INVESTIMENTOS */}
        <section id="especialidades" className="fnr-plans">
          <ScrollReveal animation="fade-up">
            <h2 className="fnr-plans__title">
              Investimentos para
              <span>sua Clínica</span>
            </h2>
            <p className="fnr-plans__lead">
              Sabemos que cada clínica tem necessidades diferentes, por isso oferecemos planos
              personalizados que se adaptam ao seu faturamento e complexidade.
            </p>
          </ScrollReveal>

          <div className="fnr-plans__grid">
            {plans.map((plan, index) => (
              <ScrollReveal key={plan.title} animation="fade-up" delay={index * 0.1}>
                <article className={`fnr-plan${plan.items.length > 0 ? " fnr-plan--detailed" : ""}`}>
                  <div className="fnr-plan__icon">
                    <Image
                      src={plan.icon}
                      alt=""
                      width={plan.iconSize[0]}
                      height={plan.iconSize[1]}
                    />
                  </div>

                  <h3 style={{ maxWidth: plan.titleWidth }}>{plan.title}</h3>

                  {plan.items.length > 0 && (
                    <ul>
                      {plan.items.map((item) => (
                        <li key={item}>
                          <Image src="/finora/check.svg" alt="" width={17} height={18} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  <a
                    href={whatsappLink(
                      `Olá! Tenho uma clínica odontológica e gostaria de saber mais sobre o plano ${plan.title} da FINORA.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fnr-plan__cta"
                  >
                    Saiba Mais
                  </a>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* DEPOIMENTOS */}
        <section className="fnr-testimonials">
          <ScrollReveal animation="fade-up">
            <h2 className="fnr-testimonials__title">Recomendações de Nossos Clientes</h2>
          </ScrollReveal>

          <div className="fnr-testimonials__grid">
            {testimonials.map((testimonial, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={index * 0.1}>
                <figure className="fnr-testimonial">
                  <TestimonialCardArt />
                  <figcaption className="fnr-testimonial__name">{testimonial.name}</figcaption>
                  <blockquote>“{testimonial.text}”</blockquote>
                  <span className="fnr-testimonial__location">{testimonial.location}</span>
                </figure>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="duvidas" className="fnr-faq">
          <ScrollReveal animation="fade-up">
            <h2 className="fnr-faq__title">Perguntas frequentes</h2>
          </ScrollReveal>

          <FinoraFaq items={faqs} />
        </section>
      </div>

      <FinoraFooter />
    </main>
  );
}
