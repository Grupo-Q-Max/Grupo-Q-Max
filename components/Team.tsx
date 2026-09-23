"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Users, Sparkles, UserCircle2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  sector: string;
  image: string | null;
  order: number;
}

// Accent colors cycling per member index
const ACCENTS = [
  { color: "#14d0c1", rgb: "20,208,193" },
  { color: "#e91e8c", rgb: "233,30,140" },
  { color: "#a855f7", rgb: "168,85,247" },
];

const SLIDE_DURATION = 5000;

export function Team() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const animating = useRef(false);

  // Fetch team from API
  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data: TeamMember[]) => {
        setTeam(data.sort((a, b) => a.order - b.order));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const goTo = useCallback((index: number, dir: "next" | "prev") => {
    if (animating.current) return;
    animating.current = true;
    setDirection(dir);
    setCurrent(index);
    setAnimKey((k) => k + 1);
    setProgress(0);
    startRef.current = Date.now();
    setTimeout(() => {
      animating.current = false;
    }, 650);
  }, []);

  const goNext = useCallback(() => {
    if (team.length === 0) return;
    setCurrent((c) => {
      const n = (c + 1) % team.length;
      goTo(n, "next");
      return c;
    });
  }, [goTo, team.length]);

  const goPrev = useCallback(() => {
    if (team.length === 0) return;
    setCurrent((c) => {
      const n = (c - 1 + team.length) % team.length;
      goTo(n, "prev");
      return c;
    });
  }, [goTo, team.length]);

  // Auto-play
  useEffect(() => {
    if (team.length <= 1) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const n = (current + 1) % team.length;
      goTo(n, "next");
    }, SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, goTo, team.length]);

  // Progress bar
  useEffect(() => {
    if (team.length <= 1) return;
    setProgress(0);
    startRef.current = Date.now();
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      const pct = Math.min(
        ((Date.now() - startRef.current) / SLIDE_DURATION) * 100,
        100
      );
      setProgress(pct);
    }, 30);
    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [current, team.length]);

  const m = team[current];
  const accent = m ? ACCENTS[current % ACCENTS.length] : ACCENTS[0];

  return (
    <section id="time" className="qteam">
      {/* Background glow */}
      <div
        className="qteam__sceneBg"
        style={
          {
            "--accent": accent.color,
            "--accent-rgb": accent.rgb,
          } as React.CSSProperties
        }
      />

      <div className="container qteam__wrap">
        {/* Header */}
        <header className="qteam__header">
          <span className="eyebrow">
            <Users size={13} />
            NOSSO TIME
          </span>
          <h2>
            Pessoas que fazem{" "}
            <em>
              acontecer<span className="qmax-punctuation">.</span>
            </em>
          </h2>
          <p>
            Profissionais dedicados a transformar o seu negócio com inovação e
            qualidade dentro do ecossistema <strong>Q-Max</strong>.
          </p>
        </header>

        {/* Loading / empty */}
        {!loaded && (
          <div className="qteam__skeleton">
            <div className="qteam__skeletonCard" />
          </div>
        )}

        {loaded && team.length === 0 && (
          <div className="qteam__empty">
            <UserCircle2 size={56} />
            <p>Nenhum membro cadastrado ainda.</p>
          </div>
        )}

        {/* Carousel */}
        {loaded && team.length > 0 && (
          <>
            <div className="qteam__stage">
              {/* Card */}
              <div
                key={animKey}
                className={`qteam__card qteam__card--enter-${direction}`}
                style={
                  {
                    "--accent": accent.color,
                    "--accent-rgb": accent.rgb,
                  } as React.CSSProperties
                }
              >
                {/* Photo area */}
                <div className="qteam__photoFrame">
                  {m.image ? (
                    <Image
                      src={m.image}
                      alt={m.name}
                      fill
                      style={{ objectFit: "cover" }}
                      sizes="420px"
                      priority
                      unoptimized
                    />
                  ) : (
                    <div className="qteam__photoFallback">
                      <div className="qteam__avatarRing" />
                      <div className="qteam__avatarPulse" />
                      <span className="qteam__avatarInitials">
                        {m.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Name + sector overlay at the bottom of the photo */}
                  <div className="qteam__overlay">
                    <span className="qteam__sector">{m.sector}</span>
                    <h3 className="qteam__name">{m.name}</h3>
                    <p className="qteam__role">{m.role}</p>
                  </div>
                </div>

                {/* Progress bar */}
                {team.length > 1 && (
                  <div className="qteam__progress">
                    <div
                      className="qteam__progressFill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Prev / Next */}
              {team.length > 1 && (
                <>
                  <button
                    className="qteam__ctrl qteam__ctrl--left"
                    onClick={goPrev}
                    aria-label="Membro anterior"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    className="qteam__ctrl qteam__ctrl--right"
                    onClick={goNext}
                    aria-label="Próximo membro"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {/* Dots */}
            {team.length > 1 && (
              <div className="qteam__dots" role="tablist" aria-label="Membros">
                {team.map((_, i) => (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={i === current}
                    className={`qteam__dot${i === current ? " qteam__dot--active" : ""}`}
                    style={
                      i === current
                        ? ({ "--accent": accent.color } as React.CSSProperties)
                        : undefined
                    }
                    onClick={() => goTo(i, i > current ? "next" : "prev")}
                    aria-label={`Ver membro ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* CTA */}
        <div className="qteam__cta">
          <a href="#contato" className="button button--primary">
            <Sparkles size={15} />
            Fale com nossa equipe
          </a>
        </div>
      </div>
    </section>
  );
}
