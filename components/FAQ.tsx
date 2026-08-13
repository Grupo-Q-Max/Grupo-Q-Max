"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";

const questions = [
  {
    question: "O que é o ecossistema Q-Max?",
    answer:
      "É a integração de empresas e soluções especializadas em auditoria, contabilidade, pessoas, tecnologia, estrutura e produtos digitais, conectadas por uma mesma visão de qualidade, inovação e desenvolvimento empresarial.",
  },
  {
    question: "Preciso contratar todas as empresas do grupo?",
    answer:
      "Não. Cada empresa atua de forma independente em sua especialidade. A vantagem do ecossistema é permitir que diferentes necessidades do negócio sejam atendidas de forma mais integrada quando fizer sentido.",
  },
  {
    question: "Como saber qual solução é ideal para minha empresa?",
    answer:
      "A equipe Q-Max pode entender o seu cenário e direcionar você para a empresa ou solução mais adequada, de acordo com o momento e os objetivos do seu negócio.",
  },
  {
    question: "A Q-Max atende empresas de diferentes segmentos?",
    answer:
      "Sim. As soluções do ecossistema foram estruturadas para apoiar empresas de diferentes portes e setores, respeitando as particularidades de cada operação.",
  },
  {
    question: "Posso falar diretamente com uma empresa do ecossistema?",
    answer:
      "Sim. Você pode acessar cada empresa pela seção Empresas ou entrar em contato com o Grupo Q-Max para ser direcionado ao time correto.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
            Respostas rápidas para entender como o ecossistema Q-Max
            pode se conectar ao seu negócio.
          </p>
        </div>

        <div className="faq43__list">
          {questions.map((item, index) => {
            const open = openIndex === index;

            return (
              <button
                key={item.question}
                type="button"
                className={`faq43__item ${
                  open ? "is-open" : ""
                }`}
                onClick={() =>
                  setOpenIndex(open ? null : index)
                }
                aria-expanded={open}
                aria-controls={`faq-panel-${index}`}
              >
                <div className="faq43__question">
                  <span>
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <strong>{item.question}</strong>

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
                  <p>{item.answer}</p>
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
              <em> Precisa das conexões certas.</em>
            </h3>

            <p>
              Fale com a Q-Max e descubra quais empresas e soluções
              fazem sentido para o seu momento.
            </p>
          </div>

          <a href="#contato">
            Fale com a Q-Max
            <ArrowUpRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}