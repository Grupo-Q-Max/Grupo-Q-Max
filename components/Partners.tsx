"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Users, UserCircle2 } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  sector: string;
  image: string | null;
  order: number;
}

export function Partners() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/team", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: TeamMember[]) => {
        setTeam(data.sort((a, b) => a.order - b.order));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const topPartners = team.slice(0, 2);
  const bottomPartners = team.slice(2, 8); // next 6

  return (
    <section id="socios" className="qpartners">
      <div className="container">
        <ScrollReveal animation="fade-up">
          <header className="qpartners__header">
            <span className="eyebrow">
              <Users size={13} />
              NOSSOS SÓCIOS
            </span>
            <h2>
              Liderança que faz{" "}
              <em className="qmax-brand-word">
                acontecer<span className="qmax-punctuation">.</span>
              </em>
            </h2>
            <p>
              Os visionários por trás do <strong>Grupo Q-Max</strong>. Conheça as mentes estratégicas que guiam nosso ecossistema empresarial rumo à excelência.
            </p>
          </header>
        </ScrollReveal>

        {!loaded && <div className="qpartners__loading">Carregando sócios...</div>}
        
        {loaded && team.length === 0 && (
          <div className="qpartners__empty">
            <UserCircle2 size={56} />
            <p>Nenhum sócio cadastrado ainda.</p>
          </div>
        )}

        {loaded && team.length > 0 && (
          <div className="qpartners__grid">
            {/* Top 2 */}
            <div className="qpartners__topRow">
              {topPartners.map((partner, i) => (
                <ScrollReveal key={partner.id} animation="fade-up" delay={i * 0.15}>
                  <PartnerCard partner={partner} variant="large" />
                </ScrollReveal>
              ))}
            </div>

            {/* Bottom 6 */}
            {bottomPartners.length > 0 && (
              <div className="qpartners__bottomRow">
                {bottomPartners.map((partner, i) => (
                  <ScrollReveal key={partner.id} animation="fade-up" delay={0.2 + (i * 0.1)}>
                    <PartnerCard partner={partner} variant="small" />
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .qpartners {
          padding: var(--section) 0;
          background: #050506;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .qpartners__header {
          text-align: center;
          margin-bottom: clamp(60px, 8vw, 90px);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .qpartners__header h2 {
          font-size: clamp(40px, 5vw, 64px);
          line-height: 1;
          letter-spacing: -0.05em;
          margin: 16px 0 24px;
        }
        .qpartners__header p {
          max-width: 600px;
          color: #aaa5af;
          font-size: 18px;
          line-height: 1.6;
          margin: 0;
        }
        .qpartners__empty, .qpartners__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          color: #666;
          padding: 80px 0;
        }
        .qpartners__grid {
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .qpartners__topRow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 32px;
        }
        .qpartners__bottomRow {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
        }
        @media (min-width: 1024px) {
          .qpartners__topRow {
            grid-template-columns: 1fr 1fr;
          }
          .qpartners__bottomRow {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </section>
  );
}

function PartnerCard({ partner, variant }: { partner: TeamMember, variant: "large" | "small" }) {
  const isLarge = variant === "large";
  return (
    <div className={`partner-card ${isLarge ? 'partner-card--large' : 'partner-card--small'}`}>
      {/* Moldura em cápsula (Figma: Protótipo Grupo, nó 6-138) */}
      <div className="partner-card__frame">
        <div className="partner-card__image-wrap">
          {partner.image ? (
            <Image
              src={partner.image}
              alt={partner.name}
              fill
              unoptimized
              style={{ objectFit: "contain", objectPosition: "bottom center" }}
            />
          ) : (
            <div className="partner-card__fallback">
              <UserCircle2 size={isLarge ? 64 : 40} />
            </div>
          )}
          {/* Liner magenta na base da foto (Figma) */}
          <span className="partner-card__liner" aria-hidden="true" />
        </div>
        {partner.role && <span className="partner-card__badge">{partner.role}</span>}
      </div>
      <h3 className="partner-card__name">{partner.name}</h3>

      <style jsx>{`
        .partner-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: ${isLarge ? '24px' : '16px'};
          transition: transform 0.4s ease;
        }
        .partner-card:hover {
          transform: translateY(-8px);
        }
        /*
         * Medidas do Figma (Protótipo Grupo, grupo 6:134) numa base de 296px de
         * largura; em cqw para escalar junto com o card (100cqw = 296px).
         */
        .partner-card__frame {
          position: relative;
          container-type: inline-size;
          width: ${isLarge ? 'min(100%, 296px)' : 'min(100%, 190px)'};
        }
        .partner-card__image-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 296 / 503.087;
          border-radius: 46.28cqw; /* 137px */
          overflow: hidden;
          /* Contorno branco de 6px (6:136), abaixo da foto */
          box-shadow: inset 0 0 0 2.027cqw #ffffff;
          transition: filter 0.4s ease;
        }
        /* Liner magenta da base (6:138) */
        .partner-card__liner {
          position: absolute;
          top: 1.566%; /* 7.878px */
          right: 0;
          bottom: 0;
          left: 0;
          z-index: 1;
          border-radius: 46.28cqw;
          background: linear-gradient(
            180deg,
            rgba(217, 15, 129, 0) 0%,
            rgba(217, 15, 129, 0.1) 50%,
            rgba(217, 15, 129, 0.2) 71.76%,
            rgba(217, 15, 129, 0.4) 93.52%
          );
          pointer-events: none;
        }
        .partner-card:hover .partner-card__image-wrap {
          filter: drop-shadow(0 18px 40px rgba(217, 15, 129, 0.35));
        }
        .partner-card__fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.15);
        }
        .partner-card__badge {
          position: absolute;
          left: 50%;
          bottom: ${isLarge ? '16px' : '10px'};
          transform: translateX(-50%);
          z-index: 3;
          max-width: 90%;
          padding: ${isLarge ? '8px 18px' : '6px 12px'};
          border-radius: 9999px;
          background: #d90f81;
          color: #fff;
          font-size: ${isLarge ? '16px' : '11px'};
          font-weight: 800;
          letter-spacing: 0.02em;
          line-height: 1.1;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .partner-card__name {
          margin: 0;
          font-size: ${isLarge ? '28px' : '18px'};
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #d90f81;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
