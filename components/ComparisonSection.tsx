import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { QmaxInline } from "@/components/QmaxBrandText";

const comparisonPoints = [
  {
    topic: "Estrutura dos Serviços",
    traditional: "Fornecedores separados para contabilidade, RH, TI e auditoria (retrabalho e falta de alinhamento).",
    qmax: "Ecossistema empresarial 360° integrado sob uma mesma governança estratégica.",
  },
  {
    topic: "Atendimento & Proximidade",
    traditional: "Respostas genéricas em canais impessoais e chamados que demoram dias.",
    qmax: "Atendimento consultivo e personalizado com especialistas dedicados ao seu segmento.",
  },
  {
    topic: "Planejamento Tributário",
    traditional: "Apenas emissão de guias no fim do mês sem diagnóstico estratégico de economia.",
    qmax: "Planejamento tributário contínuo e proativo para redução legal de impostos.",
  },
  {
    topic: "Tecnologia & Inovação",
    traditional: "Processos manuais, planilhas desorganizadas e burocracia excessiva.",
    qmax: "Plataformas digitais próprias (QXBACK, QXSIGN, FINORA) para acelerar a gestão.",
  },
  {
    topic: "Infraestrutura Física",
    traditional: "Você precisa alugar escritórios caros e assumir custos fixos elevados.",
    qmax: "Endereço fiscal, comercial e armazenagem inteligente com flexibilidade total (Lagerhaus).",
  },
];

export function ComparisonSection() {
  return (
    <section className="qmax-comparison" id="diferenciais">
      <div className="container">
        <header className="qmax-comparison__header text-center">
          <span className="eyebrow">
            <Sparkles size={13} />
            POR QUE O GRUPO <QmaxInline>Q-MAX</QmaxInline>?
          </span>

          <h2>
            A diferença entre contratar fornecedores soltos
            <br />
            e contar com um <em>ecossistema integrado.</em>
          </h2>

          <p>
            Veja por que mais de 400 empresas escolheram o Grupo <QmaxInline>Q-Max</QmaxInline> para
            centralizar sua contabilidade, auditoria, RH, tecnologia e infraestrutura.
          </p>
        </header>

        <div className="qmax-comparison__grid">
          {/* TRADICIONAL */}
          <div className="qmax-comparison__column qmax-comparison__column--traditional">
            <div className="qmax-comparison__colHead">
              <span className="qmax-comparison__badge qmax-comparison__badge--bad">
                <XCircle size={15} />
                MODELO TRADICIONAL
              </span>
              <h3>Serviços Isolados</h3>
              <p>Fragmentação, lentidão e risco de inconsistências fiscais e trabalhistas.</p>
            </div>

            <div className="qmax-comparison__list">
              {comparisonPoints.map((pt, idx) => (
                <div key={idx} className="qmax-comparison__item qmax-comparison__item--bad">
                  <div className="qmax-comparison__itemHeader">
                    <XCircle size={18} className="qmax-comparison__crossIcon" />
                    <strong>{pt.topic}</strong>
                  </div>
                  <p>{pt.traditional}</p>
                </div>
              ))}
            </div>
          </div>

          {/* GRUPO Q-MAX */}
          <div className="qmax-comparison__column qmax-comparison__column--qmax">
            <div className="qmax-comparison__colHead">
              <span className="qmax-comparison__badge qmax-comparison__badge--good">
                <CheckCircle2 size={15} />
                ECOSSISTEMA <QmaxInline>Q-MAX</QmaxInline>
              </span>
              <h3>Solução Completa 360°</h3>
              <p>Governança única, consultoria estratégica e tecnologia proprietária para o seu negócio.</p>
            </div>

            <div className="qmax-comparison__list">
              {comparisonPoints.map((pt, idx) => (
                <div key={idx} className="qmax-comparison__item qmax-comparison__item--good">
                  <div className="qmax-comparison__itemHeader">
                    <CheckCircle2 size={18} className="qmax-comparison__checkIcon" />
                    <strong>{pt.topic}</strong>
                  </div>
                  <p>{pt.qmax}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
