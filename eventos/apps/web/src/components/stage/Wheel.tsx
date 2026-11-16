"use client";

import { useEffect, useState } from "react";
import { FinoraLogo } from "@/components/brand/Brand";
import { RARITY, getPrizeRarity } from "./rarity";

const COMMON_FILLS = ["#131B2E", "#1E2A47"];
const LED_COUNT = 24;

// 24 LEDs distribuídos em círculo ao redor da borda da roleta
const LED_DOTS = Array.from({ length: LED_COUNT }, (_, i) => {
  const rad = ((i * 360) / LED_COUNT) * (Math.PI / 180);
  return {
    left: `${(50 + 48.6 * Math.cos(rad)).toFixed(2)}%`,
    top: `${(50 + 48.6 * Math.sin(rad)).toFixed(2)}%`,
    delay: `${((i / LED_COUNT) * 0.8).toFixed(2)}s`,
    idleDelay: `${((i % 6) * 0.35).toFixed(2)}s`,
  };
});

// Roda da roleta de altíssima fidelidade física e performance GPU:
// - Disco giratório acelerado via hardware (translateZ(0) + will-change)
// - Aro estático com casing metálico profundo (evita re-rasterização por frame)
// - Pinos metálicos prateados com relevo 3D
// - Ponteiro com clique mecânico sincronizado ao ticker de desaceleração
// - LEDs dinâmicos de alta intensidade
export default function Wheel({
  names,
  rotation,
  spinning,
  durationMs,
  tickerCount = 0,
  onSpin,
}: {
  names: string[];
  rotation: number;
  spinning: boolean;
  durationMs: number;
  tickerCount?: number;
  onSpin?: () => void;
}) {
  const [flick, setFlick] = useState(false);

  // Efeito mecânico de rebote do ponteiro em sincronia com o tick da catraca
  useEffect(() => {
    if (spinning && tickerCount > 0) {
      setFlick(true);
      const timer = setTimeout(() => setFlick(false), 75);
      return () => clearTimeout(timer);
    }
  }, [spinning, tickerCount]);

  const step = 360 / Math.max(names.length, 1);
  const fills = names.map((name, i) => {
    const rarity = getPrizeRarity(name);
    return rarity === "COMMON" ? COMMON_FILLS[i % 2] : RARITY[rarity].color;
  });

  const background = `conic-gradient(from ${-step / 2}deg, ${fills
    .map((f, i) => `${f} ${i * step}deg ${(i + 1) * step}deg`)
    .join(", ")})`;

  // Pinos físicos nas divisórias das fatias que giram JUNTO com o disco
  const pinDots = Array.from({ length: names.length }, (_, i) => {
    const deg = i * step - step / 2;
    const rad = (deg - 90) * (Math.PI / 180);
    return {
      left: `${(50 + 45.8 * Math.cos(rad)).toFixed(2)}%`,
      top: `${(50 + 45.8 * Math.sin(rad)).toFixed(2)}%`,
      key: i,
    };
  });

  const handleWheelClick = () => {
    if (!spinning && onSpin) {
      onSpin();
    }
  };

  return (
    <div
      onClick={handleWheelClick}
      role={onSpin && !spinning ? "button" : undefined}
      tabIndex={onSpin && !spinning ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && onSpin && !spinning) {
          e.preventDefault();
          onSpin();
        }
      }}
      className={`@container relative aspect-square w-full select-none ${
        onSpin && !spinning
          ? "cursor-pointer transition-transform duration-200 hover:scale-[1.015] active:scale-[0.985]"
          : ""
      }`}
      title={onSpin && !spinning ? "Clique para girar a roleta!" : undefined}
    >
      {/* Halo de luz e pulso neon externo */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-full opacity-70 blur-3xl transition-all duration-700"
        style={{
          background: "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 72%)",
          transform: spinning ? "scale(1.15)" : "scale(1)",
        }}
      />

      {/* Casing Fixo Estático (Sombra 3D e aro chanfrado - não gira, isolando o custo de pintura) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_8px_#0A1020,0_0_0_12px_rgba(255,255,255,0.14),0_0_0_18px_#141E36,0_20px_70px_rgba(0,0,0,0.92)] z-5"
      />

      {/* Disco Giratório com Aceleração de Hardware GPU (will-change + translateZ) */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_0_35px_rgba(0,0,0,0.8)]"
        style={{
          background,
          transform: `rotate(${rotation}deg) translateZ(0)`,
          willChange: "transform",
          backfaceVisibility: "hidden",
          transition: spinning ? `transform ${durationMs}ms cubic-bezier(0.15, 0.92, 0.24, 1)` : "none",
        }}
      >
        {/* Nomes dos Prêmios nas Fatias */}
        {names.map((name, i) => {
          const dark = getPrizeRarity(name) !== "COMMON";
          return (
            <div
              key={`${name}-${i}`}
              className="absolute inset-0 flex justify-center"
              style={{ transform: `rotate(${i * step}deg)` }}
            >
              <span
                className={`mt-[7%] line-clamp-2 text-center text-[clamp(12px,3.4cqw,20px)] font-black leading-tight select-none ${
                  dark ? "text-ink-950 font-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]" : "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                }`}
                style={{ maxWidth: `${Math.min(72, 2 * 44 * Math.sin((step * Math.PI) / 360))}%` }}
              >
                {name}
              </span>
            </div>
          );
        })}

        {/* Pinos metálicos prateados com relevo 3D que giram com as fatias */}
        {pinDots.map((pin) => (
          <span
            key={pin.key}
            className="absolute size-2.5 sm:size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 shadow-[0_2px_4px_rgba(0,0,0,0.9),inset_0_1px_2px_rgba(255,255,255,0.95)]"
            style={{
              left: pin.left,
              top: pin.top,
              background: "radial-gradient(circle at 35% 35%, #FFFFFF 0%, #CBD5E1 45%, #64748B 85%, #334155 100%)",
            }}
          />
        ))}

        {/* Vinheta interna suave */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_50px_rgba(0,0,0,0.7)]"
        />
      </div>

      {/* Reflexo de domo de vidro com brilho especular curvo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-full overflow-hidden"
      >
        <div className="absolute -top-1/2 left-0 right-0 h-full rounded-[100%] bg-gradient-to-b from-white/14 via-white/4 to-transparent blur-[1px]" />
      </div>

      {/* Anel de lâmpadas LED ao redor do aro */}
      <div className="pointer-events-none absolute inset-0 rounded-full z-15" aria-hidden="true">
        {LED_DOTS.map((led, i) => (
          <span
            key={i}
            className={`absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 transition-transform ${
              spinning ? "bg-white shadow-[0_0_10px_#fff,0_0_18px_var(--event-accent,#22C3DC)]" : "bg-accent/80 shadow-[0_0_6px_var(--event-accent,#22C3DC)]"
            }`}
            style={{
              left: led.left,
              top: led.top,
              animation: spinning
                ? `ledChase 0.4s linear infinite ${led.delay}`
                : `ledBlink 2.2s ease-in-out infinite alternate ${led.idleDelay}`,
            }}
          />
        ))}
      </div>

      {/* Miolo Central Estático com Logo Finora e anéis metálicos nobres */}
      <div className="absolute top-1/2 left-1/2 flex size-[29%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-accent bg-gradient-to-b from-[#18233C] via-[#0D1527] to-[#060A13] shadow-[0_0_35px_rgba(0,0,0,0.95),inset_0_3px_10px_rgba(255,255,255,0.35),0_0_25px_var(--event-accent,#22C3DC)] z-20 pointer-events-none">
        <div className="absolute inset-1.5 rounded-full border border-white/20 shadow-inner" />
        <div className="absolute inset-3 rounded-full border border-accent/30 bg-gradient-to-tr from-black/80 via-transparent to-white/10" />
        <div className="relative z-10 flex items-center justify-center p-2.5 transition-transform hover:scale-105">
          <FinoraLogo variant="symbol" className="drop-shadow-[0_4px_14px_rgba(0,0,0,0.9)] filter brightness-110" />
        </div>
      </div>

      {/* Ponteiro Físico no Topo com Efeito de Catraca Realista */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[34px] left-1/2 z-30 -translate-x-1/2 origin-top transition-transform duration-75 ease-out"
        style={{
          transform: flick
            ? "translateX(-50%) rotate(-15deg)"
            : spinning
            ? "translateX(-50%) rotate(-3deg)"
            : "translateX(-50%) rotate(0deg)",
        }}
      >
        <div className="relative drop-shadow-[0_8px_16px_rgba(0,0,0,0.95)]">
          {/* Lâmina do ponteiro */}
          <div className="h-0 w-0 border-x-[26px] border-t-[58px] border-x-transparent border-t-accent" />
          <div className="absolute top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[44px] border-x-transparent border-t-white/50" />
          <div className="absolute top-3 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[26px] border-x-transparent border-t-black/40" />
          {/* Rebite metálico de fixação com reflexo */}
          <span className="absolute -top-1.5 left-1/2 size-4 -translate-x-1/2 rounded-full border border-white/80 bg-gradient-to-br from-white via-slate-200 to-slate-600 shadow-[0_0_12px_#fff,0_2px_4px_rgba(0,0,0,0.6)]" />
        </div>
      </div>
    </div>
  );
}
