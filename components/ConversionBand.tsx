"use client";

import { motion } from "framer-motion";
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
        <motion.div
          className="conversion18__panel"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <div className="conversion18__copy">
            <span className="eyebrow">
              <Sparkles size={13} />
              GRUPO Q-MAX
            </span>

            <h2>
              Um ecossistema.
              <br />
              <em>M\u00FAltiplas possibilidades.</em>
            </h2>

            <p>
              {
                "Especialidades diferentes, conectadas por uma mesma vis\u00E3o de qualidade, inova\u00E7\u00E3o e desenvolvimento empresarial."
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
        </motion.div>
      </div>
    </section>
  );
}