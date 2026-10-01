"use client";

import { QmaxInline } from "@/components/QmaxBrandText";
import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";

type FAQCategory = "todas" | "ecossistema" | "contabil" | "auditoria" | "finora" | "talents" | "lagerhaus";

const categories: { id: FAQCategory; label: string }[] = [
  { id: "todas", label: "Todas as Dúvidas" },
  { id: "ecossistema", label: "Ecossistema Geral" },
  { id: "contabil", label: "Contábil & BPO" },
  { id: "auditoria", label: "Auditoria" },
  { id: "finora", label: "Clínicas / FINORA" },
  { id: "talents", label: "RH & Talents" },
  { id: "lagerhaus", label: "Lagerhaus & Coworking" },
];

const questions = [
  {
    category: "ecossistema" as FAQCategory,
    question: "O que é o ecossistema Q-Max?",
    answer:
      "É a integração de empresas e soluções especializadas em auditoria, contabilidade, pessoas, tecnologia, estrutura e produtos digitais, conectadas por uma mesma visão de qualidade, inovação e desenvolvimento empresarial.",
  },
  {
    category: "ecossistema" as FAQCategory,
    question: "Preciso contratar todas as empresas do grupo?",
    answer:
      "Não. Cada empresa atua de forma independente em sua especialidade. A vantagem do ecossistema é permitir que diferentes necessidades do negócio sejam atendidas de forma mais integrada quando fizer sentido.",
  },
  {
    category: "contabil" as FAQCategory,
    question: "Como funciona a troca de contador para a Q-Max Contábil?",
    answer:
      "O processo é 100% digital e sem atrito. Cuidamos de toda a transição de documentos, livros fiscais e certidões junto ao seu contador anterior sem que sua operação sofra qualquer interrupção.",
  },
  {
    category: "auditoria" as FAQCategory,
    question: "Quando minha empresa precisa de Auditoria Independente?",
    answer:
      "A auditoria é indicada para empresas que buscam conformidade fiscal, reporte a investidores/conselhos, obtenção de crédito bancário ou preparação para fusões e aquisições (M&A).",
  },
  {
    category: "finora" as FAQCategory,
    question: "Como a FINORA reduz impostos para clínicas odontológicas?",
    answer:
      "Aplicamos estratégias legais como a equiparação hospitalar, segregação de receitas e planejamento societário, que podem reduzir em até 60% a carga tributária efetiva da clínica.",
  },
  {
    category: "talents" as FAQCategory,
    question: "Como funciona o recrutamento e seleção da Q-Max Talents?",
    answer:
      "Realizamos a atração, triagem técnica e testes comportamentais rigorosos alinhados à cultura da sua empresa, garantindo assertividade de 98% no fechamento das vagas.",
  },
  {
    category: "lagerhaus" as FAQCategory,
    question: "Qual a diferença entre endereço fiscal e comercial na Lagerhaus?",
    answer:
      "O endereço fiscal serve para o registro legal do CNPJ junto à Receita e órgãos municipais. O endereço comercial é utilizado em materiais e no site para prestígio de marca, além de permitir o uso de salas de reunião.",
  },
  {
    category: "ecossistema" as FAQCategory,
    question: "A Q-Max atende empresas de diferentes segmentos e portes?",
    answer:
      "Sim. As soluções do ecossistema foram estruturadas para apoiar empresas desde profissionais liberais até indústrias e médias empresas, respeitando as particularidades de cada operação.",
  },
];

export function FAQ() {
  const [activeCategory, setActiveCategory] = useState<FAQCategory>("todas");
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredQuestions = activeCategory === "todas"
    ? questions
    : questions.filter((q) => q.category === activeCategory);

  return (
    <section className="faq43">
      <div className="container faq43__inner">
        <div className="faq43__header">
          <div>
            <span className="faq43__eyebrow">
              <Sparkles size={14} />
              PERGUNTAS FREQUENTES
            </span>

            <h2>
              Antes de começar,
              <em> talvez você queira saber.</em>
            </h2>
          </div>

          <p>
            Respostas rápidas para entender como o ecossistema{" "}<QmaxInline>Q-Max</QmaxInline>{" "}
            pode se conectar ao seu negócio.
          </p>
        </div>

        {/* CATEGORY TABS */}
        <div className="faq43__tabs" role="tablist" aria-label="Categorias do FAQ">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat.id}
              className={`faq43__tabBtn ${activeCategory === cat.id ? "active" : ""}`}
              onClick={() => {
                setActiveCategory(cat.id);
                setOpenIndex(0);
              }}
              role="tab"
              aria-selected={activeCategory === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="faq43__list">
          {filteredQuestions.map((item, index) => {
            const open = openIndex === index;

            return (
              <button
                key={item.question}
                type="button"
                className={`faq43__item ${open ? "is-open" : ""}`}
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                aria-controls={`faq-panel-${index}`}
              >
                <div className="faq43__question">
                  <span>{String(index + 1).padStart(2, "0")}</span>

                  <strong><QmaxInline>{item.question}</QmaxInline></strong>

                  <ChevronDown
                    size={20}
                    className="faq43__icon"
                  />
                </div>

                <div
                  id={`faq-panel-${index}`}
                  className="faq43__answer"
                  role="region"
                  aria-hidden={!open}
                >
                  <p><QmaxInline>{item.answer}</QmaxInline></p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="faq43__cta">
          <div>
            <small>AINDA TEM DÚVIDAS?</small>

            <h3>
              Seu negócio não precisa de mais fornecedores.
              <em> Precisa das conexões acertadas.</em>
            </h3>

            <p>
              Fale com a <QmaxInline>Q-Max</QmaxInline> e descubra qual empresa e solução
              faz sentido para o seu momento.
            </p>
          </div>

          <a href="#contato">
            Fale com a <QmaxInline>Q-Max</QmaxInline>
            <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

