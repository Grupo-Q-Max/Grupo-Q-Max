import { ArrowRight, CheckCircle2, Compass, Layers, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { QmaxInline } from "@/components/QmaxBrandText";

const steps = [
  {
    number: "01",
    title: "Diagnóstico Estratégico 360°",
    kicker: "ANÁLISE INICIAL",
    icon: Compass,
    color: "#14d0c1",
    description: "Mapeamos o cenário fiscal, contábil, de processos, pessoas e tecnologia do seu negócio para identificar gargalos e oportunidades imediatas de economia.",
    highlight: "Análise consultiva sob medida",
  },
  {
    number: "02",
    title: "Plano de Ação Sob Medida",
    kicker: "ESTRATÉGIA & CONEXÃO",
    icon: Layers,
    color: "#d90f81",
    description: "Desenhamos uma estratégia personalizada, conectando as empresas e ferramentas do Grupo Q-Max que fazem sentido exato para o seu momento.",
    highlight: "Soluções integradas e sinérgicas",
  },
  {
    number: "03",
    title: "Implementação & Tecnologia",
    kicker: "EXECUÇÃO & PLATAFORMAS",
    icon: ShieldCheck,
    color: "#3156ff",
    description: "Transição suave e sem atrito. Configuramos nossas plataformas digitais e alinhamos a governança com a sua equipe com agilidade total.",
    highlight: "Processos sem burocracia",
  },
  {
    number: "04",
    title: "Acompanhamento & Economia",
    kicker: "RESULTADOS CONTÍNUOS",
    icon: TrendingUp,
    color: "#fbbf24",
    description: "Gestão consultiva ativa com relatórios mensais claros, planejamento tributário recorrente e acompanhamento próximo para maximizar seus lucros.",
    highlight: "Foco no seu crescimento",
  },
];

export function JourneyTimeline() {
  return (
    <section className="qmax-journey" id="jornada">
      <div className="container">
        <header className="qmax-journey__header text-center">
          <span className="eyebrow">
            <Sparkles size={13} />
            COMO FUNCIONA A JORNADA
          </span>

          <h2>
            Do primeiro diagnóstico
            <br />
            ao <em>crescimento sustentável.</em>
          </h2>

          <p>
            Um método estruturado em 4 passos para transformar a gestão da sua empresa com segurança e previsibilidade.
          </p>
        </header>

        <div className="qmax-journey__grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="qmax-journey__card">
                <div className="qmax-journey__top">
                  <span
                    className="qmax-journey__number"
                    style={{ color: step.color }}
                  >
                    {step.number}
                  </span>
                  <div
                    className="qmax-journey__icon"
                    style={{ color: step.color, borderColor: `${step.color}40`, background: `${step.color}15` }}
                  >
                    <Icon size={20} />
                  </div>
                </div>

                <div className="qmax-journey__body">
                  <small className="qmax-journey__kicker" style={{ color: step.color }}>
                    {step.kicker}
                  </small>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>

                <div className="qmax-journey__footer">
                  <CheckCircle2 size={15} style={{ color: step.color }} />
                  <span>{step.highlight}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
