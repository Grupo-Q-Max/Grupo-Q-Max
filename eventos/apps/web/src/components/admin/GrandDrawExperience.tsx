"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { CircleAlert, LoaderCircle, RefreshCw, Search, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";
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
};

type Props = {
  eventId: number;
  eventName: string;
  initialParticipants: Participant[];
};

const TOTAL_STEPS = 75;

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
  const [prizeName, setPrizeName] = useState<string>("Câmera Intraoral");
  const [isDrawing, setIsDrawing] = useState(false);
  const [reel, setReel] = useState<Participant | null>(initialParticipants[0] || null);
  const [lockedDigits, setLockedDigits] = useState(0);
  const [target, setTarget] = useState<string[] | null>(null);
  const [winner, setWinner] = useState<WinnerData | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [search, setSearch] = useState("");
  const [loadingEligible, setLoadingEligible] = useState(false);
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

      // Rolos giram; nos passos finais cada dígito trava, da esquerda para a direita.
      const step = () => {
        iterations++;
        const remaining = TOTAL_STEPS - iterations;
        setLockedDigits(Math.max(0, winningDigits - Math.ceil(remaining / 8)));
        setReel(participants[Math.floor(Math.random() * participants.length)]);

        if (soundEnabled) {
          if (iterations > TOTAL_STEPS - 12) playSlowdownSound();
          else if (iterations % 2 === 0) playTickSound(650 + (iterations % 4) * 120);
        }

        if (iterations < TOTAL_STEPS) {
          animationRef.current = setTimeout(step, Math.floor(20 + Math.pow(iterations / TOTAL_STEPS, 3.2) * 550));
          return;
        }

        setReel(winningParticipant);
        setLockedDigits(winningDigits);
        setWinner(drawResult);
        setIsDrawing(false);

        if (soundEnabled) {
          playWinSound();
          playApplauseSound();
          announcePrizeVoice(winningParticipant.fullName, prizeName);
        }
        const colors = [eventAccent(), "#0077FF", "#FFD700", "#FFFFFF", "#38BDF8"];

        // Canhões de estádio imediatos
        confetti({
          particleCount: 150,
          spread: 120,
          origin: { x: 0.5, y: 0.5 },
          colors,
          disableForReducedMotion: true,
        });
        setTimeout(() => {
          confetti({ particleCount: 100, angle: 60, spread: 80, origin: { x: 0.05, y: 0.8 }, colors, disableForReducedMotion: true });
        }, 200);
        setTimeout(() => {
          confetti({ particleCount: 100, angle: 120, spread: 80, origin: { x: 0.95, y: 0.8 }, colors, disableForReducedMotion: true });
        }, 400);

        const end = Date.now() + 5000;
        const burst = setInterval(() => {
          if (Date.now() > end) return clearInterval(burst);
          confetti({ startVelocity: 45, spread: 360, ticks: 90, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors, disableForReducedMotion: true });
        }, 250);
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
      className={`h-11 rounded-xl px-5 font-semibold ${activeTab === key ? "bg-ink-700 text-ink-text" : "text-ink-text-2"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex w-full flex-col text-ink-text relative">
      {/* Palco da revelação */}
      <section className="relative flex min-h-[78dvh] flex-col items-center justify-center gap-12 overflow-hidden px-6 pt-28 pb-12 text-center">
        {/* Background Cyber-Grid e Aura Luminosa */}
        <div className="cyber-grid-overlay pointer-events-none opacity-40" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[850px] bg-accent/15 rounded-full blur-[160px] pointer-events-none" />

        <div className="absolute top-8 right-8 left-8 flex flex-wrap items-center justify-between gap-4 text-left z-10">
          <div className="flex items-center gap-4">
            <QmaxBrandLogo height={32} />
            <span className="h-8 w-0.5 bg-ink-line" />
            <FinoraLogo height={32} />
            <span className="h-8 w-0.5 bg-ink-line" />
            <span className="font-mono text-[clamp(13px,1.4vw,26px)] tracking-[0.08em] text-accent uppercase">Sorteio Geral · {eventName}</span>
          </div>
          <span className="text-[clamp(16px,1.6vw,30px)] text-ink-text-2">
            <strong className="font-display text-[clamp(24px,2.3vw,44px)] text-ink-text">{participants.length}</strong> {participants.length === 1 ? "cupom concorrendo" : "cupons concorrendo"}
          </span>
        </div>

        <span className="text-[clamp(20px,2.1vw,40px)] text-ink-text-2 z-10">
          {isDrawing ? (
            <span className="font-bold text-accent animate-pulse">Sorteando cupom vencedor…</span>
          ) : (
            <>
              O ganhador de <strong className="text-ink-text drop-shadow-[0_2px_15px_rgba(255,255,255,0.3)]">{prizeName || "Grande prêmio"}</strong> é o cupom
            </>
          )}
        </span>

        {participants.length === 0 ? (
          <p className="text-2xl text-ink-text-2 z-10">Nenhum participante elegível ainda.</p>
        ) : (
          <div className="flex items-center gap-[clamp(8px,1vw,20px)] z-10" role="img" aria-label={winner ? `Cupom ${getTicketCode(shown)}` : "Rolos do sorteio"}>
            {prefix && <span className="mr-3 font-mono text-[clamp(44px,4.6vw,88px)] font-bold text-ink-text-2">{prefix}</span>}
            {digits.map((d, i) => {
              const isLocked = target && i < lockedDigits;
              return (
                <span
                  key={i}
                  className={`flex h-[clamp(110px,10.4vw,200px)] w-[clamp(80px,7.8vw,150px)] items-center justify-center rounded-card border-2 font-mono text-[clamp(64px,6.25vw,120px)] font-black transition-all duration-300 ${
                    isLocked
                      ? "animate-pop-burst border-accent bg-accent text-ink-950 shadow-[0_0_45px_rgba(var(--accent-rgb),0.85)] scale-105"
                      : "border-ink-line/80 bg-ink-800/90 text-ink-text shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                  }`}
                >
                  {d}
                </span>
              );
            })}
          </div>
        )}

        <div className="flex min-h-[clamp(90px,8vw,170px)] flex-col items-center gap-3 z-10">
          {shown && (
            <div className="animate-pop-burst flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-accent/20 px-6 py-2 shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)]">
                <span className="font-mono text-sm font-black tracking-widest text-accent uppercase">
                  🎉 GRANDE VENCEDOR FINORA
                </span>
              </div>
              <span className="font-display text-[clamp(56px,6.25vw,120px)] leading-none font-black tracking-[-0.045em] text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]">
                {shown.fullName}
              </span>
              <span className="text-[clamp(18px,1.9vw,36px)] text-ink-text-2 font-medium">
                {[shown.clinicName, shown.city && `${shown.city}/${shown.state ?? ""}`].filter(Boolean).join(" · ")}
              </span>
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
              {isDrawing ? <><LoaderCircle size={22} className="animate-spin" /> Sorteando…</> : "Sortear agora"}
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
              Novo sorteio
            </button>
          )}
          <button
            type="button"
            onClick={reloadParticipants}
            disabled={loadingEligible || isDrawing}
            aria-label="Recarregar elegíveis"
            className="flex size-14 items-center justify-center rounded-full border border-ink-line disabled:opacity-50"
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
            {tab("DRAW", "Concorrentes")}
            {tab("HISTORY", "Histórico")}
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
              <span className="font-mono text-xs tracking-[0.08em] text-ink-text-2">CONCORRENTES · {filteredParticipants.length}</span>
              <div className="flex h-12 w-full max-w-sm items-center gap-2 rounded-xl border border-ink-line bg-ink-900 px-3.5">
                <Search size={18} className="text-ink-text-2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cupom, nome ou clínica"
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-text-2"
                />
              </div>
            </div>
            <ul className="grid max-h-[400px] grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
              {filteredParticipants.map((p) => (
                <li key={p.participationId} className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-900 px-4 py-3">
                  <span className="min-w-0">
                    <strong className="block truncate">{p.fullName}</strong>
                    <span className="block truncate text-sm text-ink-text-2">{p.clinicName || "Sem clínica"}</span>
                  </span>
                  <span className="flex-none font-mono text-sm text-accent">{getTicketCode(p)}</span>
                </li>
              ))}
              {filteredParticipants.length === 0 && <li className="col-span-full py-10 text-center text-ink-text-2">Nenhum concorrente encontrado.</li>}
            </ul>
          </div>
        ) : loadingHistory ? (
          <span className="flex items-center gap-2 py-10 text-ink-text-2">
            <LoaderCircle size={18} className="animate-spin" /> Carregando histórico…
          </span>
        ) : historyLogs.length === 0 ? (
          <p className="py-10 text-ink-text-2">Nenhum sorteio geral registrado neste evento.</p>
        ) : (
          <ul className="flex flex-col">
            {historyLogs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 py-4">
                <span>
                  <strong className="block">{log.description}</strong>
                  <span className="text-sm text-ink-text-2">
                    #{log.id} · {log.actorType}
                  </span>
                </span>
                <span className="font-mono text-sm text-ink-text-2">{new Date(log.drawnAt).toLocaleString("pt-BR")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
