"use client";

import { Flag, Eye, Diamond } from "lucide-react";

export function MissionVisionValues() {
  const pillars = [
    {
      id: "mission",
      title: "MISSÃO",
      icon: Flag,
      description: "Assegurar soluções e serviços de alta qualidade e preservar a nossa reputação e do cliente utilizando-se de atitudes éticas.",
      bullets: ["Ambiente Colaborativo", "Crescimento Sustentável"],
      delay: "0s",
    },
    {
      id: "vision",
      title: "VISÃO",
      icon: Eye,
      description: "Ser reconhecida como líder em soluções empresariais inovadoras, criando valor real para nossos clientes.",
      bullets: ["Liderança em Inovação", "Valor real para Clientes"],
      delay: "0.15s",
    },
    {
      id: "values",
      title: "VALORES",
      icon: Diamond,
      description: "Norteiam as nossas ações e estão relacionados aos compromissos e nosso jeito de ser.",
      bullets: [
        "Colaboração e Conexão",
        "Sustentabilidade e Responsabilidade",
        "Inovação com Propósito",
        "Ética e Transparência",
      ],
      delay: "0.3s",
    },
  ];

  return (
    <section className="qprinciples" id="proposito">
      <div className="container">
        <header className="qprinciples__header">
          <span className="eyebrow">
            <Diamond size={13} />
            NOSSO PROPÓSITO
          </span>
          <h2>
            1. MISSÃO, <em className="qmax-brand-word">VISÃO</em> E VALORES
          </h2>
          <p>
            Fundado em 1998, o Grupo Q-Max é um ecossistema empresarial sustentável que reúne as melhores empresas e profissionais para criar soluções inovadoras e impactantes. Comprometidos com práticas ESG.
          </p>
        </header>

        <div className="qprinciples__grid">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.id}
                className="qprinciples__card"
                style={{ animationDelay: pillar.delay }}
              >
                <div className="qprinciples__cardIcon">
                  <Icon size={32} strokeWidth={1.5} />
                </div>
                <h3>
                  {index + 1}. <span className="qmax-brand-word">{pillar.title}</span>
                </h3>
                <p className="qprinciples__desc">{pillar.description}</p>
                <ul className="qprinciples__list">
                  {pillar.bullets.map((bullet, i) => (
                    <li key={i}>
                      <span className="qprinciples__bulletPoint" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <div className="qprinciples__cardGlow" />
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .qprinciples {
          padding: var(--section) 0;
          background: #050506;
          border-top: 1px solid rgba(255, 255, 255, 0.045);
          position: relative;
          overflow: hidden;
        }

        .qprinciples::before {
          content: "";
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 80%;
          height: 500px;
          background: radial-gradient(ellipse at center, rgba(217, 15, 129, 0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .qprinciples__header {
          text-align: center;
          margin-bottom: clamp(60px, 8vw, 100px);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qprinciples__header h2 {
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1;
          letter-spacing: -0.05em;
          margin: 16px 0 24px;
        }

        .qprinciples__header p {
          max-width: 760px;
          color: #aaa5af;
          font-size: 18px;
          line-height: 1.6;
          margin: 0;
        }

        .qprinciples__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
          position: relative;
          z-index: 2;
        }

        .qprinciples__card {
          background: rgba(18, 18, 24, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 48px 36px;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .qprinciples__cardIcon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(217, 15, 129, 0.2), rgba(217, 15, 129, 0.05));
          border: 1px solid rgba(217, 15, 129, 0.3);
          color: #d90f81;
          display: grid;
          place-items: center;
          margin-bottom: 32px;
          box-shadow: 0 10px 30px -10px rgba(217, 15, 129, 0.4);
          transition: transform 0.4s ease;
        }

        .qprinciples__card:hover .qprinciples__cardIcon {
          transform: scale(1.1) translateY(-4px);
        }

        .qprinciples__card h3 {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          margin: 0 0 16px;
          color: #ffffff;
        }

        .qprinciples__desc {
          color: #9d98a2;
          font-size: 16px;
          line-height: 1.7;
          margin: 0 0 32px;
          flex-grow: 1;
        }

        .qprinciples__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .qprinciples__list li {
          color: #e4e4e7;
          font-size: 15px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .qprinciples__bulletPoint {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d90f81;
          box-shadow: 0 0 10px #d90f81;
          flex-shrink: 0;
        }

        .qprinciples__cardGlow {
          position: absolute;
          width: 200px;
          height: 200px;
          background: #d90f81;
          filter: blur(120px);
          border-radius: 50%;
          top: -50px;
          right: -50px;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .qprinciples__card:hover {
          transform: translateY(-8px);
          border-color: rgba(217, 15, 129, 0.4);
          box-shadow: 0 20px 50px -15px rgba(0, 0, 0, 0.6),
                      0 0 30px rgba(217, 15, 129, 0.15);
        }

        .qprinciples__card:hover .qprinciples__cardGlow {
          opacity: 0.15;
        }

        @media (max-width: 900px) {
          .qprinciples__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
