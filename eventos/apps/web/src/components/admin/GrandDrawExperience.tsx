"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  CircleAlert,
  LoaderCircle,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle2,
  ShieldCheck,
  Trophy,
  Sparkles,
  Gift,
} from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { playTickSound, playSlowdownSound, playWinSound, playApplauseSound, announcePrizeVoice } from "@/lib/audio";
import { FinoraLogo, QmaxBrandLogo } from "@/components/brand/Brand";

type Participant = {
  participationId: number;
  participantId: number;
  ticketCode?: string;
  fullName: string;
  cpfLastDigits: string;
  phone: string | null;
  email: string | null;
  cro: string | null;
  clinicName: string;
  city: string | null;
  state: string | null;
};

type WinnerData = {
  winner: Participant;
  prize: string;
  drawnAt: string;
  totalCompetitors: number;
};

type HistoryLog = {
  id: number;
  drawnAt: string;
  description: string | null;
  actorType: string;
  participantId: number | null;
  prizeName?: string;
  position?: number;
  isDelivered?: boolean;
};

type Props = {
  eventId: number;
  eventName: string;
  initialParticipants: Participant[];
};

const TOTAL_STEPS = 72;

function getTicketCode(p?: Participant | null): string {
  if (!p) return "#0000";
  if (p.ticketCode) return p.ticketCode;
  return `#${String(p.participantId || p.participationId || 0).padStart(4, "0")}`;
}

// "#0317" → prefixo "#" e dígitos "0317" (os dígitos viram rolos).
function splitCode(code: string) {
  const m = code.match(/^(.*?)(\d+)$/);
  return m ? { prefix: m[1], digits: m[2].split("") } : { prefix: "", digits: code.split("") };
}

function eventAccent() {
  const el = document.querySelector("[data-event]") ?? document.documentElement;
  return getComputedStyle(el).getPropertyValue("--event-accent").trim() || "#22C3DC";
}

export default function GrandDrawExperience({ eventId, eventName, initialParticipants }: Props) {
  const [activeTab, setActiveTab] = useState<"DRAW" | "HISTORY">("DRAW");
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [prizeName, setPrizeName] = useState<string>("Fotopolimerizador");
  const [isDrawing, setIsDrawing] = useState(false);
  const [reel, setReel] = useState<Participant | null>(initialParticipants[0] || null);
  const [lockedDigits, setLockedDigits] = useState(0);
  const [target, setTarget] = useState<string[] | null>(null);
  const [winner, setWinner] = useState<WinnerData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const animationRef = useRef<NodeJS.Timeout | null>(null);

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
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setSoundEnabled((prev) => !prev);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (winner) {
          setWinner(null);
          setTarget(null);
        } else if (!isDrawing && participants.length > 0) {
          startGrandDraw();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [winner, isDrawing, participants.length]);

  useEffect(() => () => {
    if (animationRef.current) clearTimeout(animationRef.current);
  }, []);

  useEffect(() => {
    if (activeTab !== "HISTORY") return;
    setLoadingHistory(true);
    fetch(`${getAdminProxyUrl()}/draws/event/${eventId}/grand-draw-history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHistoryLogs(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [activeTab, eventId]);

  async function reloadParticipants() {
    setLoadingEligible(true);
    try {
      const res = await fetch(`${getAdminProxyUrl()}/draws/event/${eventId}/eligible-grand-draw`);
      const data = await res.json();
      if (Array.isArray(data?.participants)) {
        setParticipants(data.participants);
        setReel(data.participants[0] || null);
      }
    } catch {
      // ignore
    } finally {
      setLoadingEligible(false);
    }
  }

  async function handleClaimPrize(participantId: number) {
    setClaimingId(participantId);
    try {
      const res = await fetch(`${getAdminProxyUrl()}/draws/event/${eventId}/grand-draw/${participantId}/claim`, {
        method: "POST",
      });
      if (res.ok) {
        setHistoryLogs((logs) =>
          logs.map((l) => (l.participantId === participantId ? { ...l, isDelivered: true } : l)),
        );
      }
    } catch {
      // ignore
    } finally {
      setClaimingId(null);
    }
  }

  async function startGrandDraw() {
    if (participants.length === 0 || isDrawing) return;

    setIsDrawing(true);
    setWinner(null);
    setError(null);
    setLockedDigits(0);

    try {
      const res = await fetch(`${getAdminProxyUrl()}/draws/event/${eventId}/grand-draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prizeName }),
      });

      const drawResult = await res.json();
      if (!res.ok || !drawResult.winner) {
        throw new Error(drawResult.message || "Erro ao realizar sorteio.");
      }

      const winningParticipant: Participant = drawResult.winner;
      const targetDigits = splitCode(getTicketCode(winningParticipant)).digits;
      const winningDigits = targetDigits.length;
      setTarget(targetDigits);
      let iterations = 0;
      let prevLockedCount = 0;

      // Rolos mecânicos giram em alta velocidade; nos passos finais cada dígito trava da esquerda para a direita.
      const step = () => {
        iterations++;
        const remaining = TOTAL_STEPS - iterations;
        const currentLocked = Math.max(0, winningDigits - Math.ceil(remaining / 7));

        // Efeito sonoro a cada trava de dígito (Lock Chime)
        if (currentLocked > prevLockedCount) {
          prevLockedCount = currentLocked;
          if (soundEnabled) {
            playTickSound(1100 + currentLocked * 160);
          }
        }

        setLockedDigits(currentLocked);
        setReel(participants[Math.floor(Math.random() * participants.length)]);

        if (soundEnabled) {
          if (iterations > TOTAL_STEPS - 12) playSlowdownSound();
          else if (iterations % 2 === 0) playTickSound(650 + (iterations % 4) * 120);
        }

        if (iterations < TOTAL_STEPS) {
          animationRef.current = setTimeout(step, Math.floor(22 + Math.pow(iterations / TOTAL_STEPS, 3.2) * 540));
          return;
        }

        // Todos os dígitos travaram no cupom vencedor!
        setReel(winningParticipant);
        setLockedDigits(winningDigits);

        // Clímax e suspense dramático de 550ms antes da grande revelação
        animationRef.current = setTimeout(() => {
          setWinner(drawResult);
          setIsDrawing(false);

          // REGRA DE OURO ANTIDUPLICIDADE NO FRONTEND:
          // Remove imediatamente o vencedor da lista local de participantes elegíveis
          setParticipants((prev) => prev.filter((p) => p.participantId !== winningParticipant.participantId));

          if (soundEnabled) {
            playWinSound();
            playApplauseSound();
            announcePrizeVoice(winningParticipant.fullName, prizeName);
          }
          // Celebração ultra-leve otimizada para mobile / celular (50 partículas em disparo único)
          confetti({
            particleCount: 50,
            spread: 80,
            origin: { x: 0.5, y: 0.5 },
            colors: [eventAccent(), "#0077FF", "#FFD700", "#FFFFFF", "#38BDF8"],
            disableForReducedMotion: true,
          });
        }, 550);
      };

      step();
    } catch (err) {
      setIsDrawing(false);
      setError(err instanceof Error ? err.message : "Erro no sorteio.");
    }
  }

  const searchLower = search.toLowerCase();
  const filteredParticipants = participants.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchLower) ||
      (p.clinicName && p.clinicName.toLowerCase().includes(searchLower)) ||
      (p.city && p.city.toLowerCase().includes(searchLower)) ||
      getTicketCode(p).toLowerCase().includes(searchLower) ||
      String(p.participantId).includes(searchLower) ||
      (p.cpfLastDigits && p.cpfLastDigits.includes(searchLower)),
  );

  const { prefix, digits: reelDigits } = splitCode(getTicketCode(reel));
  const digits = target ? target.map((t, i) => (i < lockedDigits ? t : reelDigits[i] ?? "0")) : reelDigits;
  const shown = winner?.winner;

  const tab = (key: "DRAW" | "HISTORY", label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(key)}
      aria-pressed={activeTab === key}
      className={`h-11 rounded-xl px-5 font-semibold transition-colors cursor-pointer ${
        activeTab === key ? "bg-ink-700 text-ink-text shadow-sm" : "text-ink-text-2 hover:text-white"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col text-ink-text relative">
      {/* Palco da revelação */}
      <section className="relative flex min-h-[78dvh] flex-col items-center justify-center gap-10 overflow-hidden px-6 pt-28 pb-12 text-center">
        {/* Background Cyber-Grid e Aura Luminosa leve sem blur pesado */}
        <div className="cyber-grid-overlay pointer-events-none opacity-40" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 72%)" }}
        />

        <div className="absolute top-8 right-8 left-8 flex flex-wrap items-center justify-between gap-4 text-left z-10">
          <div className="flex items-center gap-4">
            <QmaxBrandLogo height={32} />
            <span className="h-8 w-0.5 bg-ink-line" />
            <FinoraLogo height={32} />
            <span className="h-8 w-0.5 bg-ink-line" />
            <span className="font-mono text-[clamp(13px,1.4vw,26px)] tracking-[0.08em] text-accent uppercase font-bold">
              Sorteio Geral · {eventName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-1 text-xs font-mono font-bold text-emerald-300 shadow-sm">
              <ShieldCheck size={14} className="text-emerald-400" /> Antiduplicidade Ativa
            </span>
            <span className="text-[clamp(15px,1.5vw,26px)] text-ink-text-2 font-medium">
              <strong className="font-display text-[clamp(22px,2.2vw,38px)] text-ink-text">{participants.length}</strong>{" "}
              {participants.length === 1 ? "cupom concorrendo" : "cupons concorrendo"}
            </span>
          </div>
        </div>

        {/* Banner do Prêmio Oficial 19/11 */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-slate-900/90 to-amber-500/15 px-5 py-2.5 shadow-[0_0_35px_rgba(255,215,0,0.18)] z-10 max-w-xl animate-fade-in">
          <div className="relative h-14 w-14 flex-none overflow-hidden rounded-xl border border-amber-400/50 bg-white/10 p-1 shadow-inner">
            <img
              src="/fotopolimerizador.jpg"
              alt="Fotopolimerizador"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-mono text-[11px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-400" /> Sorteio Geral Oficial · 19/11
            </span>
            <strong className="text-base font-bold text-white leading-tight">
              {prizeName || "Fotopolimerizador"}
            </strong>
            <span className="text-xs text-slate-300">
              Prêmio exclusivo de encerramento do evento
            </span>
          </div>
        </div>

        <span className="text-[clamp(19px,2vw,36px)] text-ink-text-2 z-10 font-medium">
          {isDrawing ? (
            <span className="font-bold text-accent animate-pulse flex items-center justify-center gap-2">
              <Sparkles size={24} className="text-accent animate-spin" /> Sorteando cupom vencedor ao vivo…
            </span>
          ) : (
            <>
              O ganhador de <strong className="text-ink-text drop-shadow-[0_2px_15px_rgba(255,255,255,0.3)]">{prizeName || "Grande Prêmio"}</strong> é o cupom:
            </>
          )}
        </span>

        {participants.length === 0 && !winner ? (
          <div className="flex flex-col items-center gap-3 z-10 py-8">
            <ShieldCheck size={48} className="text-emerald-400" />
            <p className="text-2xl text-ink-text font-bold">Todos os participantes elegíveis já foram premiados!</p>
            <p className="text-ink-text-2 max-w-md">Consulte a aba de Histórico para conferir os ganhadores registrados.</p>
          </div>
        ) : (
          <div
            className="flex items-center gap-[clamp(8px,1vw,20px)] z-10"
            role="img"
            aria-label={winner ? `Cupom ${getTicketCode(shown)}` : "Rolos do sorteio"}
          >
            {prefix && (
              <span className="mr-2 sm:mr-3 font-mono text-[clamp(44px,4.6vw,88px)] font-black text-accent/80 drop-shadow-md">
                {prefix}
              </span>
            )}
            {digits.map((d, i) => {
              const isLocked = Boolean(target && i < lockedDigits);
              return (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span
                    className={`font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-opacity duration-300 ${
                      isLocked ? "text-accent" : isDrawing ? "text-amber-400/80 animate-pulse" : "text-transparent"
                    }`}
                  >
                    {isLocked ? "TRAVADO ✓" : isDrawing ? "GIRANDO…" : "AGUARDANDO"}
                  </span>
                  <div
                    className={`relative flex h-[clamp(115px,11vw,210px)] w-[clamp(80px,8vw,155px)] items-center justify-center rounded-2xl border-2 font-mono text-[clamp(64px,6.5vw,125px)] font-black transition-all duration-300 select-none overflow-hidden ${
                      isLocked
                        ? "border-accent bg-gradient-to-b from-accent via-accent/95 to-accent/80 text-ink-950 shadow-[0_0_50px_rgba(var(--accent-rgb),0.85),inset_0_2px_12px_rgba(255,255,255,0.7)] scale-105"
                        : "border-ink-line/80 bg-ink-800/90 text-ink-text shadow-[0_12px_32px_rgba(0,0,0,0.55),inset_0_1px_4px_rgba(255,255,255,0.1)]"
                    }`}
                  >
                    {/* Reflexo de vidro no topo do visor */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

                    {/* Dígito com blur dinâmico enquanto gira rápido */}
                    <span
                      className={`relative z-10 transition-all ${
                        isDrawing && !isLocked ? "filter blur-[1.2px] scale-105" : "filter-none scale-100"
                      }`}
                    >
                      {d}
                    </span>

                    {/* Linha divisória sutil de catraca / tambor mecânico */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-black/20 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Teleprompter dinâmico de participantes ou Revelação do Vencedor */}
        <div className="flex min-h-[clamp(90px,8vw,170px)] flex-col items-center justify-center gap-3 z-10 w-full max-w-4xl px-4">
          {/* Durante o sorteio: Teleprompter dinâmico de participantes */}
          {isDrawing && reel && (
            <div className="flex flex-col items-center gap-2.5 animate-fade-in transition-all">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/50 bg-ink-900/90 px-5 py-1.5 shadow-[0_0_25px_rgba(var(--accent-rgb),0.35)]">
                <span className="inline-block size-2.5 rounded-full bg-accent animate-ping" />
                <span className="font-mono text-xs sm:text-sm font-bold tracking-widest text-accent uppercase">
                  Rastreando cupom premiado ao vivo…
                </span>
              </div>
              <span className="font-display text-[clamp(28px,3.8vw,58px)] leading-tight font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] filter blur-[0.3px]">
                {reel.fullName}
              </span>
              <span className="text-[clamp(14px,1.4vw,22px)] text-ink-text-2 font-semibold truncate max-w-2xl">
                {[reel.clinicName, reel.city && `${reel.city}/${reel.state ?? ""}`].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          {/* Vencedor Revelado com Efeito de Estádio */}
          {shown && (
            <div className="animate-pop-burst flex flex-col items-center gap-3.5 w-full">
              <div className="inline-flex items-center gap-2.5 rounded-full border-2 border-[#FFD700] bg-gradient-to-r from-[#FFD700]/25 via-amber-500/20 to-[#FFD700]/25 px-6 py-2 shadow-[0_0_35px_rgba(255,215,0,0.5)]">
                <Trophy size={18} className="text-[#FFD700]" />
                <span className="font-mono text-sm sm:text-base font-black tracking-widest text-[#FFDF73] uppercase">
                  GRANDE VENCEDOR FINORA · CUPOM {getTicketCode(shown)}
                </span>
              </div>
              <span className="font-display text-[clamp(44px,5.8vw,100px)] leading-none font-black tracking-[-0.04em] text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_12px_40px_rgba(0,0,0,0.95)]">
                {shown.fullName}
              </span>
              <span className="text-[clamp(17px,1.8vw,30px)] text-ink-text-2 font-semibold">
                {[shown.clinicName, shown.city && `${shown.city}/${shown.state ?? ""}`, shown.cro && `CRO ${shown.cro}`].filter(Boolean).join(" · ")}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/50 bg-emerald-500/15 px-3.5 py-1 text-xs font-mono font-bold text-emerald-300">
                  <ShieldCheck size={14} /> Antiduplicidade: Vencedor registrado e excluído de futuros sorteios
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1 text-xs font-mono font-bold text-accent">
                  <Gift size={14} /> Prêmio: {prizeName || "Grande Prêmio"}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Controles do operador */}
      <section className="flex flex-col gap-6 border-t border-ink-line px-6 py-8 lg:px-12 bg-ink-900/60 backdrop-blur-md">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[260px] flex-1 flex-col gap-2 text-[15px] font-semibold text-ink-text-2">
            Prêmio do sorteio
            <input
              value={prizeName}
              onChange={(e) => setPrizeName(e.target.value)}
              disabled={isDrawing || !!winner}
              className="h-14 rounded-field bg-white px-4 text-lg font-semibold text-text outline-none disabled:opacity-60"
            />
          </label>
          {!winner ? (
            <button
              type="button"
              onClick={startGrandDraw}
              disabled={isDrawing || participants.length === 0}
              className="flex h-14 items-center gap-2.5 rounded-full bg-accent px-10 text-xl font-black text-ink-950 shadow-[0_0_30px_rgba(var(--accent-rgb),0.55)] hover:scale-105 active:scale-95 transition-all cursor-pointer animate-pulse-glow disabled:opacity-50 disabled:animate-none"
            >
              {isDrawing ? (
                <>
                  <LoaderCircle size={22} className="animate-spin" /> Sorteando…
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Sortear agora
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setWinner(null);
                setTarget(null);
              }}
              className="flex h-14 items-center gap-2 rounded-full border-2 border-accent/60 bg-accent/15 px-8 text-lg font-bold text-accent shadow-[0_0_25px_rgba(var(--accent-rgb),0.3)] hover:bg-accent hover:text-ink-950 transition-all cursor-pointer"
            >
              <RefreshCw size={18} /> Sortear Próximo Prêmio
            </button>
          )}
          <button
            type="button"
            onClick={reloadParticipants}
            disabled={loadingEligible || isDrawing}
            aria-label="Recarregar elegíveis"
            title="Recarregar lista de cupons elegíveis"
            className="flex size-14 items-center justify-center rounded-full border border-ink-line hover:bg-ink-800 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={20} className={loadingEligible ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Desligar som (M)" : "Ligar som (M)"}
            title={soundEnabled ? "Desligar som (M)" : "Ligar som (M)"}
            className="flex size-14 items-center justify-center rounded-full border border-ink-line hover:bg-ink-800 transition-colors cursor-pointer"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            className="flex size-14 items-center justify-center rounded-full border border-ink-line hover:bg-ink-800 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <div className="ml-auto flex gap-1 rounded-2xl bg-ink-800 p-1">
            {tab("DRAW", `Concorrentes (${participants.length})`)}
            {tab("HISTORY", "Histórico de Premiados")}
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-2 font-semibold text-[#FF8FA3]">
            <CircleAlert size={18} /> {error}
          </p>
        )}

        {activeTab === "DRAW" ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs tracking-[0.08em] text-ink-text-2 flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" /> CUPONS ELEGÍVEIS (SEM REPETIÇÃO) · {filteredParticipants.length}
              </span>
              <div className="flex h-12 w-full max-w-sm items-center gap-2 rounded-xl border border-ink-line bg-ink-900 px-3.5">
                <Search size={18} className="text-ink-text-2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cupom, nome ou clínica"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-text-2 text-white"
                />
              </div>
            </div>
            <ul className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
              {filteredParticipants.map((p) => (
                <li key={p.participationId} className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-900 px-4 py-3">
                  <span className="min-w-0">
                    <strong className="block truncate text-white">{p.fullName}</strong>
                    <span className="block truncate text-sm text-ink-text-2">{p.clinicName || "Sem clínica"}</span>
                  </span>
                  <span className="flex-none font-mono text-sm font-bold text-accent">{getTicketCode(p)}</span>
                </li>
              ))}
              {filteredParticipants.length === 0 && (
                <li className="col-span-full py-10 text-center text-ink-text-2">
                  Nenhum participante concorrente encontrado nesta busca.
                </li>
              )}
            </ul>
          </div>
        ) : loadingHistory ? (
          <span className="flex items-center gap-2 py-10 text-ink-text-2">
            <LoaderCircle size={18} className="animate-spin" /> Carregando histórico de premiados…
          </span>
        ) : historyLogs.length === 0 ? (
          <p className="py-10 text-ink-text-2">Nenhum sorteio geral registrado neste evento até o momento.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {historyLogs.map((log) => (
              <li
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-line bg-ink-900/80 p-4 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 flex-none items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Trophy size={20} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block truncate text-white">{log.description}</strong>
                    <span className="text-xs text-ink-text-2">
                      Sorteio #{log.id} · {log.actorType} · {new Date(log.drawnAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {log.isDelivered ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-mono font-bold text-emerald-400">
                      <CheckCircle2 size={13} /> Entregue
                    </span>
                  ) : log.participantId ? (
                    <button
                      type="button"
                      onClick={() => log.participantId && handleClaimPrize(log.participantId)}
                      disabled={claimingId === log.participantId}
                      className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/15 px-3 py-1 text-xs font-bold text-accent hover:bg-accent hover:text-ink-950 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {claimingId === log.participantId ? (
                        <LoaderCircle size={13} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      Marcar como Entregue
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
