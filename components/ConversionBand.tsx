import { ArrowUpRight, Sparkles } from "lucide-react";

const areas = [
  "Auditoria",
  "Contabilidade",
  "Talentos",
  "Tecnologia",
  "Estrutura",
  "Produtos digitais",
];

export function ConversionBand() {
  return (
    <section className="conversion18">
      <div className="conversion18__glow" aria-hidden="true" />

      <div className="container">
        <div
          className="conversion18__panel"
        >
          <div className="conversion18__copy">
            <span className="eyebrow">
              <Sparkles size={13} />
              GRUPO Q-MAX
            </span>

            <h2>
              Um ecossistema.
              <br />
              <em>Múltiplas possibilidades.</em>
            </h2>

            <p>
              {
                "Especialidades diferentes, conectadas por uma mesma visão de qualidade, inovação e desenvolvimento empresarial."
              }
            </p>
          </div>

          <div className="conversion18__right">
            <div className="conversion18__areas">
              {areas.map((area, index) => (
                <span key={area}>
                  <small>0{index + 1}</small>
                  {area}
                </span>
              ))}
            </div>

            <a href="#contato">
              <span>Fale com a Q-Max</span>
              <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}