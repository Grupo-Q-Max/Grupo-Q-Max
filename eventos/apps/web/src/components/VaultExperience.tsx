"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, Lock, Maximize, Minimize } from "lucide-react";
import { useSearchParams } from "next/navigation";
import confetti from "canvas-confetti";
import { getApiBaseUrl } from "@/lib/api-client";
import { playTickSound, playWinFanfare } from "@/lib/audio";
import { FinoraLogo, type EventTheme } from "@/components/brand/Brand";
import { RARITY, RarityBadge, getPrizeRarity } from "@/components/stage/rarity";

type Prize = { id: number; name: string; description: string | null; image_url: string | null };

type DrawResponse = {
  success: boolean;
  participant: { name: string };
  prize: Prize;
};

const DIGITS = 6;
const HACK_MS = 3000;

const randomDigits = () => Array.from({ length: DIGITS }, () => Math.floor(Math.random() * 10));

type VaultProps = {
  eventId: number;
  route: string;
  eventName?: string;
  event?: EventTheme;
};

export default function VaultExperience({ eventId: _eventId, route, eventName, event }: VaultProps) {
  const [phase, setPhase] = useState<"READY" | "HACKING" | "RESULT">("READY");
  const [result, setResult] = useState<DrawResponse | null>(null);
  const [error, setError] = useState("");
  const [digits, setDigits] = useState<number[]>(() => Array(DIGITS).fill(0));
  const [locked, setLocked] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const searchParams = useSearchParams();
  // O giro é por participação; participant_id fica só para links antigos.
  const participantId = searchParams.get("participation_id") ?? searchParams.get("participant_id");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === " " || e.key === "Enter") {
        if (phase === "READY") {
          e.preventDefault();
          startVault();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  useEffect(() => () => timers.current.forEach((t) => clearInterval(t)), []);

  const startVault = async () => {
    if (!participantId) {
      setError("Participante não identificado.");
      return;
    }

    setPhase("HACKING");
    setError("");
    setLocked(0);
    const target = randomDigits();

    // Dígitos ainda não travados ficam sorteando; um trava a cada fração do tempo.
    let lockedCount = 0;
    const flicker = window.setInterval(() => {
      setDigits((prev) => prev.map((d, i) => (i < lockedCount ? target[i] : Math.floor(Math.random() * 10))));
    }, 90);
    const lock = window.setInterval(() => {
      lockedCount = Math.min(lockedCount + 1, DIGITS - 1);
      setLocked(lockedCount);
      playTickSound(650 + lockedCount * 110);
    }, HACK_MS / DIGITS);
    timers.current = [flicker, lock];

    try {
      const started = Date.now();
      const res = await fetch(`${getApiBaseUrl()}/draws/participation/${participantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erro ao abrir o cofre.");

      await new Promise((r) => setTimeout(r, Math.max(0, HACK_MS - (Date.now() - started))));
      timers.current.forEach((t) => clearInterval(t));
      setDigits(target);
      setLocked(DIGITS);
      setResult(data);
      setPhase("RESULT");

      playWinFanfare();

      const rarity = getPrizeRarity(data.prize?.name);
      const accent =
        (typeof document !== "undefined" &&
          getComputedStyle(document.querySelector("[data-event]") ?? document.documentElement)
            .getPropertyValue("--event-accent")
            .trim()) ||
        event?.accent ||
        "#F5B301";
      confetti({
        particleCount: 200,
        spread: 120,
        origin: { y: 0.6 },
        colors: [accent, rarity === "COMMON" ? "#0077FF" : RARITY[rarity].color],
        disableForReducedMotion: true,
      });
    } catch (err) {
      timers.current.forEach((t) => clearInterval(t));
      setError(err instanceof Error ? err.message : "Erro ao abrir o cofre.");
      setPhase("READY");
    }
  };

  const firstName = result?.participant.name.split(" ")[0];
  const pct = Math.round((locked / DIGITS) * 100);
  const code = `#${String(participantId ?? 0).padStart(4, "0")}`;
  const displayTitle = (event?.label || eventName || "FINORA").toUpperCase();

  return (
    <div className="cyber-grid-overlay relative flex min-h-dvh flex-col items-center justify-center gap-9 px-6 py-24 overflow-hidden select-none">
      {/* Luz ambiente de fundo */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] opacity-40 transition-opacity duration-1000"
        style={{
          background: phase === "RESULT"
            ? "radial-gradient(circle, #FFDF73 0%, var(--event-accent, #22C3DC) 50%, transparent 80%)"
            : "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 70%)"
        }}
      />

      <div className="absolute top-8 right-10 left-10 flex items-center justify-between z-10">
        <div className="flex items-center gap-3.5">
          <FinoraLogo className="text-[26px]" />
          <span className="font-mono text-xs tracking-[0.08em] text-accent uppercase font-bold">COFRE VIP · {displayTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          {participantId && <span className="font-mono text-[15px] text-ink-text-2 bg-ink-800/80 px-3 py-1 rounded-full border border-ink-line">{code}</span>}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            className="flex size-10 items-center justify-center rounded-full border border-ink-line bg-ink-800/80 text-ink-text hover:text-white hover:bg-ink-700 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {phase !== "RESULT" && (
        <>
          <div className={`relative flex w-full max-w-[760px] flex-col items-center gap-7.5 rounded-[36px] border-[3px] border-accent bg-ink-900/90 p-11 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.8)] transition-all ${
            phase === "HACKING" ? "animate-pulse-glow" : "shadow-[0_0_35px_rgba(34,195,220,0.2)]"
          }`}>
            {/* Rebites e dobradiças reforçadas do cofre */}
            <span className="absolute top-[18%] -left-3.5 h-[70px] w-[18px] rounded-md bg-accent-ink shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
            <span className="absolute bottom-[18%] -left-3.5 h-[70px] w-[18px] rounded-md bg-accent-ink shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
            
            <div className="flex items-center gap-3 text-accent">
              <Lock size={28} strokeWidth={2.4} className={phase === "HACKING" ? "animate-bounce" : ""} />
              <span className="font-mono text-base font-bold tracking-[0.14em]">
                {phase === "HACKING" ? "DESCRIPTOGRAFANDO SISTEMA..." : "COFRE VIP BLOQUEADO"}
              </span>
            </div>

            <div className="flex gap-3" role="img" aria-label={`${locked} de ${DIGITS} dígitos decifrados`}>
              {digits.map((d, i) => {
                const isLocked = i < locked;
                return (
                  <span
                    key={i}
                    className={`flex h-[108px] w-[clamp(44px,9vw,80px)] items-center justify-center rounded-field font-mono text-[clamp(32px,6vw,58px)] font-black transition-all duration-200 ${
                      isLocked
                        ? "bg-accent text-ink-950 scale-105 shadow-[0_0_25px_var(--event-accent,#22C3DC)] animate-pop-burst"
                        : phase === "HACKING"
                        ? "border-2 border-accent/60 bg-ink-800 text-accent animate-pulse"
                        : "border-[1.5px] border-dashed border-[#3A4870] bg-ink-800/80 text-[#5B6A88]"
                    }`}
                  >
                    {phase === "HACKING" || isLocked ? d : "•"}
                  </span>
                );
              })}
            </div>

            <div className="flex w-full flex-col gap-2.5">
              <div className="h-3 overflow-hidden rounded-full bg-ink-800 p-0.5 border border-white/5">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-[180ms] shadow-[0_0_12px_var(--event-accent,#22C3DC)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[15px] font-semibold text-ink-text-2">
                <span>
                  {locked} de {DIGITS} dígitos decifrados
                </span>
                <span className="font-mono font-bold text-accent">{pct}%</span>
              </div>
            </div>
          </div>

          {phase === "HACKING" ? (
            <h1 className="text-center font-display text-[56px] font-extrabold tracking-[-0.03em] animate-pulse">
              Decifrando segredo...
            </h1>
          ) : (
            <button
              type="button"
              onClick={startVault}
              className="group relative h-24 rounded-full bg-accent px-14 text-[30px] font-black text-ink-950 shadow-[0_12px_45px_var(--event-accent,#22C3DC)] hover:scale-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              <span className="relative z-10 flex items-center gap-3">
                ABRIR O COFRE 🔓
              </span>
            </button>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 font-semibold text-[#FF8FA3] bg-[#FF8FA3]/10 px-4 py-2 rounded-xl border border-[#FF8FA3]/20">
              <CircleAlert size={18} /> {error}
            </p>
          )}
        </>
      )}

      {phase === "RESULT" && result && (
        <div className="animate-pop-burst grid w-full max-w-[1100px] grid-cols-1 items-center gap-12 landscape:grid-cols-[minmax(0,560px)_minmax(0,1fr)] z-10">
          <div className="relative h-[min(520px,60dvh)] [perspective:1400px]">
            {/* Feixe dourado saindo de dentro do cofre */}
            <div className="pointer-events-none absolute inset-0 -inset-x-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,223,115,0.3),transparent_70%)] blur-2xl animate-pulse" />

            <div className="holographic-card animate-float-slow absolute inset-0 flex items-center justify-center rounded-[36px] border-[3px] border-accent bg-ink-900/90 shadow-[0_20px_80px_rgba(0,0,0,0.9),0_0_50px_var(--event-accent,rgba(34,195,220,0.3))]">
              {result.prize.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.prize.image_url} alt="" className="max-h-[300px] max-w-[300px] rounded-card object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]" />
              ) : (
                <span className="font-display text-4xl font-black text-accent text-center px-6 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">{result.prize.name}</span>
              )}
            </div>
            
            {/* Porta pesada do cofre aberta em ângulo */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex origin-left items-center justify-center gap-3 rounded-[36px] border-[3px] border-accent bg-gradient-to-r from-ink-800 to-ink-900 shadow-2xl [transform:rotateY(-68deg)]"
            >
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-16 w-11 rounded-lg bg-accent/80 shadow-[0_0_12px_var(--event-accent)]" />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5.5">
            <RarityBadge rarity={getPrizeRarity(result.prize.name)} className="self-start text-lg shadow-lg" />
            <h1 className="font-display text-[clamp(52px,6vw,76px)] font-extrabold leading-[0.95] tracking-[-0.04em] text-white">
              Cofre aberto! ✨
            </h1>
            <p className="text-[26px] leading-[1.35] text-[#C7D0DF]">
              Parabéns, {firstName}! Você desbloqueou <strong className="text-accent font-black">{result.prize.name}</strong>.
            </p>
            
            <div className="flex flex-col gap-1.5 rounded-[22px] border border-accent/40 bg-gradient-to-r from-ink-800 to-ink-900/90 p-6 shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
              <span className="text-[15px] font-semibold text-ink-text-2">Retire no balcão com o código do seu bilhete:</span>
              <span className="font-mono text-[38px] font-black tracking-[0.06em] text-accent drop-shadow-[0_0_12px_var(--event-accent)]">{code}</span>
            </div>

            <Link href={`/${route}`} className="flex h-16 items-center justify-center self-start rounded-full bg-accent px-10 text-xl font-bold text-ink-950 hover:brightness-110 shadow-[0_8px_30px_var(--event-accent)] transition-all">
              Concluir Retirada →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
