import {
  ArrowDownRight,
  Eye,
  Globe2,
  HeartHandshake,
  Leaf,
  Lightbulb,
  Scale,
  Sparkles,
  Target,
} from "lucide-react";

const values = [
  {
    number: "01",
    title: "Colaboração e Conexão",
    icon: HeartHandshake,
  },
  {
    number: "02",
    title: "Sustentabilidade e Responsabilidade",
    icon: Leaf,
  },
  {
    number: "03",
    title: "Inovação com Propósito",
    icon: Lightbulb,
  },
  {
    number: "04",
    title: "Ética e Transparência",
    icon: Scale,
  },
];

export function Story() {
  return (
    <>
      <section id="sobre" className="qstory">
        <div className="qstory__noise" />
        <div className="qstory__glow" />

        <div className="container qstory__container">
          <div
            className="qstory__intro"
          >
            <span className="eyebrow">
              <Sparkles size={13} />
              NOSSO Q
            </span>

            <h2>
              Qualidade.
              <br />
              Qualificação.
              <br />
              <em>Um Q de inovação.</em>
            </h2>
          </div>

          <div
            className="qstory__statement"
          >
            <span>ECOSSISTEMA EMPRESARIAL</span>

            <p>
              Somos um ecossistema empresarial sustentável que reúne empresas
              e profissionais para criar soluções inovadoras e impactantes.
            </p>

            <div className="qstory__statementLine">
              <i />
              <small>
                Negócios conectados por uma mesma visão de qualidade,
                responsabilidade e inovação.
              </small>
            </div>
          </div>
        </div>

        <div className="container qstory__manifesto">
          <span className="qstory__index">01</span>

          <div className="qstory__manifestoCopy">
            <span>MAIS DO QUE EMPRESAS</span>

            <h3>
              Diferentes especialidades.
              <br />
              <em>Uma direção em comum.</em>
            </h3>
          </div>

          <ArrowDownRight className="qstory__arrow" />
        </div>
      </section>

      <section className="qprinciples">
        <div className="container">
          <header className="qprinciples__header">
            <div>
              <span className="eyebrow">O QUE NOS MOVE</span>

              <h2>
                Princípios que
                <br />
                <em>orientam o negócio.</em>
              </h2>
            </div>

            <p>
              Missão, visão e valores definem como o Grupo Q-Max estrutura
              relações, soluções e decisões dentro do seu ecossistema.
            </p>
          </header>

          <div className="qprinciples__main">
            <article
              className="qprinciples__card qprinciples__card--mission"
            >
              <div className="qprinciples__cardTop">
                <span>01 / MISSÃO</span>
                <Target size={22} />
              </div>

              <h3>Qualidade com atitude ética.</h3>

              <p>
                Assegurar soluções e serviços de alta qualidade e preservar
                nossa reputação e a do cliente por meio de atitudes éticas.
              </p>

              <div className="qprinciples__tags">
                <span>Ambiente Colaborativo</span>
                <span>Crescimento Sustentável</span>
              </div>
            </article>

            <article
              className="qprinciples__card qprinciples__card--vision"
            >
              <div className="qprinciples__cardTop">
                <span>02 / VISÃO</span>
                <Eye size={22} />
              </div>

              <h3>Inovação que gera valor real.</h3>

              <p>
                Ser reconhecida como líder em soluções empresariais
                inovadoras, criando valor real para nossos clientes.
              </p>

              <div className="qprinciples__tags">
                <span>Liderança em Inovação</span>
                <span>Valor Real</span>
              </div>
            </article>
          </div>

          <div className="qvalues">
            <div className="qvalues__title">
              <span>03 / VALORES</span>

              <h3>
                O jeito
                <br />
                <em>Q-Max de ser.</em>
              </h3>
            </div>

            <div className="qvalues__list">
              {values.map((value, index) => {
                const Icon = value.icon;

                return (
                  <div
                    key={value.title}
                    className="qvalues__item"
                  >
                    <span>{value.number}</span>

                    <Icon size={19} />

                    <strong>{value.title}</strong>

                    <i />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="qesg">
        <div className="qesg__world" />

        <div className="container qesg__layout">
          <div
            className="qesg__visual"
          >
            <div className="qesg__orbit qesg__orbit--1" />
            <div className="qesg__orbit qesg__orbit--2" />
            <div className="qesg__orbit qesg__orbit--3" />

            <div className="qesg__core">
              <Globe2 size={42} />
              <strong>ESG</strong>
              <span>RESPONSABILIDADE</span>
            </div>

            <span className="qesg__node qesg__node--e">E</span>
            <span className="qesg__node qesg__node--s">S</span>
            <span className="qesg__node qesg__node--g">G</span>
          </div>

          <div
            className="qesg__copy"
          >
            <span className="eyebrow">
              <Leaf size={13} />
              RESPONSABILIDADE
            </span>

            <h2>
              Crescer também é
              <br />
              pensar no <em>impacto.</em>
            </h2>

            <p>
              O Grupo Q-Max declara compromisso com práticas ambientais,
              sociais e de governança para desenvolver negócios responsáveis
              e gerar valor compartilhado.
            </p>

            <div className="qesg__pillars">
              <div>
                <span>E</span>
                <strong>Environmental</strong>
              </div>

              <div>
                <span>S</span>
                <strong>Social</strong>
              </div>

              <div>
                <span>G</span>
                <strong>Governance</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}