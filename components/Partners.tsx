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
      <div className="partner-card__image-wrap">
        {partner.image ? (
          <Image
            src={partner.image}
            alt={partner.name}
            fill
            unoptimized
            style={{ objectFit: "cover", objectPosition: "top center" }}
          />
        ) : (
          <div className="partner-card__fallback">
            <UserCircle2 size={isLarge ? 64 : 40} />
          </div>
        )}
        <div className="partner-card__overlay" />
      </div>
      <div className="partner-card__info">
        <h3>{partner.name}</h3>
        <p>{partner.role}</p>
      </div>

      <style jsx>{`
        .partner-card {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: #0d0d14;
          border: 1px solid rgba(255,255,255,0.06);
          transition: transform 0.4s ease, border-color 0.4s ease;
          display: flex;
          flex-direction: column;
        }
        .partner-card:hover {
          transform: translateY(-8px);
          border-color: rgba(217, 15, 129, 0.4);
        }
        .partner-card__image-wrap {
          position: relative;
          width: 100%;
        }
        .partner-card--large .partner-card__image-wrap {
          aspect-ratio: 4/5;
        }
        .partner-card--small .partner-card__image-wrap {
          aspect-ratio: 1/1;
        }
        .partner-card__fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111118;
          color: rgba(255,255,255,0.1);
        }
        .partner-card__overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 60%;
          background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
          pointer-events: none;
        }
        .partner-card__info {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: ${isLarge ? '32px' : '20px'};
          z-index: 2;
        }
        .partner-card__info h3 {
          font-size: ${isLarge ? '28px' : '18px'};
          font-weight: 800;
          letter-spacing: -0.02em;
          margin: 0 0 4px;
          color: #fff;
        }
        .partner-card__info p {
          font-size: ${isLarge ? '16px' : '11px'};
          color: rgba(217, 15, 129, 1);
          font-weight: 700;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
      `}</style>
    </div>
  );
}
