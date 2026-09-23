"use client";

import { useState } from "react";
import { Calculator, Sparkles, ArrowRight, CheckCircle2, TrendingDown } from "lucide-react";
import { QmaxInline } from "@/components/QmaxBrandText";

const segments = [
  {
    id: "saude",
    name: "Clínicas Odontológicas / Saúde",
    solution: "FINORA + Q-Max Contábil",
    avgSavingsRate: 0.28,
    description: "Planejamento tributário específico para a área da saúde com redução legal de alíquota e liberdade profissional.",
  },
  {
    id: "servicos",
    name: "Prestadores de Serviços & TI",
    solution: "Q-Max Technology + Contábil BPO",
    avgSavingsRate: 0.22,
    description: "Enquadramento societário inteligente e BPO Financeiro para escalar sua operação sem burocracia.",
  },
  {
    id: "comercio",
    name: "Comércio & E-commerce",
    solution: "Q-Max Contábil + Lagerhaus",
    avgSavingsRate: 0.19,
    description: "Otimização de ICMS/PIS/COFINS, endereço fiscal estratégico e armazenagem com alta eficiência.",
  },
  {
    id: "auditoria",
    name: "Médias e Grandes Empresas",
    solution: "Q-Max Auditoria & Compliance",
    avgSavingsRate: 0.25,
    description: "Auditoria independente das demonstrações, conformidade e fortalecimento de controles internos.",
  },
];

export function TaxDiagnosticCalculator() {
  const [selectedSegment, setSelectedSegment] = useState(segments[0]);
  const [monthlyRevenue, setMonthlyRevenue] = useState(60000);

  // Simple, realistic diagnostic estimation
  const estimatedTaxCost = monthlyRevenue * 0.16 * 12; // ~16% avg tax baseline
  const estimatedAnnualSavings = estimatedTaxCost * selectedSegment.avgSavingsRate;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);

  const whatsappMessage = encodeURIComponent(
    `Olá! Fiz o diagnóstico no simulador do Grupo Q-Max para o segmento "${selectedSegment.name}" (Faturamento mensal: ${formatCurrency(monthlyRevenue)}) e gostaria de validar minha economia estimada.`
  );

  return (
    <section id="diagnostico" className="qmax-calculator">
      <div className="container">
        <header className="qmax-calculator__header">
          <span className="eyebrow">
            <Calculator size={14} />
            DIAGNÓSTICO EMPRESARIAL INTERATIVO
          </span>

          <h2>
            Descubra o potencial de economia
            <br />
            do seu negócio <em>em poucos segundos.</em>
          </h2>

          <p>
            Simule como as soluções integradas do Grupo <QmaxInline>Q-Max</QmaxInline> podem otimizar
            seus tributos e acelerar a eficiência da sua operação.
          </p>
        </header>

        <div className="qmax-calculator__grid">
          <div className="qmax-calculator__controls">
            <label className="qmax-calculator__label">
              <span>01 / SELECIONE O SEU SEGMENTO</span>
            </label>

            <div className="qmax-calculator__segments">
              {segments.map((seg) => (
                <button
                  type="button"
                  key={seg.id}
                  className={`qmax-calculator__segmentBtn ${selectedSegment.id === seg.id ? "active" : ""}`}
                  onClick={() => setSelectedSegment(seg)}
                >
                  <CheckCircle2 size={16} />
                  <span>{seg.name}</span>
                </button>
              ))}
            </div>

            <div className="qmax-calculator__sliderWrap">
              <div className="qmax-calculator__sliderHead">
                <span>02 / FATURAMENTO MENSAL ESTIMADO</span>
                <strong>{formatCurrency(monthlyRevenue)}</strong>
              </div>

              <input
                type="range"
                min="10000"
                max="500000"
                step="5000"
                value={monthlyRevenue}
                onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                className="qmax-calculator__range"
                aria-label="Faturamento Mensal Estimado"
              />

              <div className="qmax-calculator__sliderScale">
                <small>R$ 10 mil</small>
                <small>R$ 250 mil</small>
                <small>R$ 500 mil+</small>
              </div>
            </div>
          </div>

          <div className="qmax-calculator__resultCard">
            <div className="qmax-calculator__resultTop">
              <span className="qmax-calculator__resultBadge">
                <TrendingDown size={14} />
                ESTIMATIVA DE ECONOMIA ANUAL
              </span>
              <strong className="qmax-calculator__resultValue">
                {formatCurrency(estimatedAnnualSavings)}
              </strong>
              <small>Economia estimada através de planejamento tributário & reestruturação</small>
            </div>

            <div className="qmax-calculator__resultSolution">
              <span className="qmax-calculator__solutionLabel">SOLUÇÃO RECOMENDADA DO GRUPO:</span>
              <strong className="qmax-calculator__solutionName">{selectedSegment.solution}</strong>
              <p>{selectedSegment.description}</p>
            </div>

            <a
              href={`https://wa.me/551128976514?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="qmax-calculator__cta"
            >
              <span>Solicitar Diagnóstico Detalhado</span>
              <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
