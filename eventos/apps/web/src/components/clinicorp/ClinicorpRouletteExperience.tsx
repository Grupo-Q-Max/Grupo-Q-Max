"use client";

import { ArrowRight, Check, CircleAlert, Crown, LoaderCircle, LogOut, Maximize, Minimize, Play, Search, Sparkles, Target, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { playChimeSound, playSlowdownSound, playTickSound, playWinFanfare, speakWinner, triggerHaptic } from "@/lib/audio";
import { getAdminProxyUrl, getApiBaseUrl } from "@/lib/api-client";
import { useLiveEvent } from "@/lib/use-live-event";
import { FinoraLogo, type EventTheme } from "@/components/brand/Brand";
import Wheel from "@/components/stage/Wheel";
import { RARITY, RarityBadge, getPrizeRarity } from "@/components/stage/rarity";

type Prize = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  available_stock: number;
  probability: string | number;
  active: boolean;
  is_vip?: boolean;
};

type DrawPrize = {
  id: number;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  stockRemaining?: number;
};

type DrawResponse = {
  success: boolean;
  alreadyDrawn?: boolean;
  draw: { id: number; source: "QUEUE" | "AUTOMATIC"; drawnAt: string };
  participation: { id: number; status: string };
  participant: { id: number; name: string };
  prize: DrawPrize;
};

type PendingParticipant = {
  participationId: number;
  participantId: number;
  vip?: boolean;
  fullName: string;
  cpfLastDigits: string;
  phone: string;
  clinicName: string | null;
  croNumber: string | null;
  croState: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
};

type Phase = "LOADING" | "READY" | "DRAWING" | "RESULT" | "ERROR";

const SPIN_MS = 5000;
const RESULT_RESET_S = 15;

function startPhysicsTicker(
  durationMs: number,
  soundEnabled: boolean,
  onTick?: () => void,
): () => void {
  let isRunning = true;
  const startTime = Date.now();

  function scheduleNextTick() {
    if (!isRunning) return;
    const elapsed = Date.now() - startTime;
    if (elapsed >= durationMs) return;

    const progress = elapsed / durationMs;

    // Desaceleração física natural e progressiva (curva exponencial):
    // 0% a 30%: 40ms a 55ms (alta rotação inicial com som rápido de catraca)
    // 30% a 65%: 60ms a 140ms (desaceleração natural)
    // 65% a 85%: 150ms a 280ms (fase de suspense)
    // 85% a 98%: 300ms a 680ms (cliques finais lentos e dramáticos)
    let nextDelay: number;
    if (progress > 0.85) {
      nextDelay = 280 + Math.pow((progress - 0.85) / 0.15, 2.2) * 400;
    } else if (progress > 0.65) {
      nextDelay = 140 + ((progress - 0.65) / 0.2) * 140;
    } else if (progress > 0.3) {
      nextDelay = 55 + ((progress - 0.3) / 0.35) * 85;
    } else {
      nextDelay = 38 + Math.random() * 8;
    }

    if (soundEnabled) {
      const pitch = 740 + Math.random() * 140;
      playTickSound(pitch);
    }
    onTick?.();

    setTimeout(scheduleNextTick, nextDelay);
  }

  scheduleNextTick();

  return () => {
    isRunning = false;
  };
}

const code = (id: number | null | undefined) => `#${String(id ?? 0).padStart(4, "0")}`;

function minutesAgo(iso?: string | null) {
  if (!iso) return "recente";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "recente";
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "agora" : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
}

function eventAccent() {
  const el = document.querySelector("[data-event]") ?? document.documentElement;
  return getComputedStyle(el).getPropertyValue("--event-accent").trim() || "#22C3DC";
}

function fireVictoryCelebration(accent: string, rarityColor: string) {
  // Comemoração ultra-leve de 40 partículas (desempenho máximo para celular/mobile)
  confetti({
    particleCount: 40,
    spread: 70,
    origin: { x: 0.5, y: 0.5 },
    colors: [accent, rarityColor, "#FFD700", "#FFFFFF"],
    disableForReducedMotion: true,
  });
}

type ClinicorpRouletteExperienceProps = {
  eventId?: number;
  event?: EventTheme;
};

export function ClinicorpRouletteExperience({ eventId: propEventId, event }: ClinicorpRouletteExperienceProps = {}) {
  const [activeEventId, setActiveEventId] = useState<number>(propEventId || 1);

  useEffect(() => {
    if (propEventId) {
      setActiveEventId(propEventId);
      return;
    }
    const queryEventId = Number(new URLSearchParams(window.location.search).get("eventId"));
    if (queryEventId > 0) setActiveEventId(queryEventId);
  }, [propEventId]);

  const [phase, setPhase] = useState<Phase>("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [participationId, setParticipationId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PendingParticipant | null>(null);
  const [participantName, setParticipantName] = useState<string>("");
  const [participantInfo, setParticipantInfo] = useState<string>("");
  const [rotation, setRotation] = useState<number>(0);
  const [result, setResult] = useState<DrawResponse | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDemoSpin, setIsDemoSpin] = useState<boolean>(false);
  // false = operador vendo a ficha; true = tablet entregue ao visitante.
  const [isParticipantConfirmed, setIsParticipantConfirmed] = useState<boolean>(false);
  const [resetIn, setResetIn] = useState(RESULT_RESET_S);

  // Autenticação do operador do estande
  const [operatorUser, setOperatorUser] = useState<{ name: string; role?: string } | null>(null);
  const [operatorUsername, setOperatorUsername] = useState<string>("admin");
  const [operatorPassword, setOperatorPassword] = useState<string>("");
  const [operatorLoginLoading, setOperatorLoginLoading] = useState<boolean>(false);
  const [operatorLoginError, setOperatorLoginError] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState<boolean>(false);

  // Fila de giros ao vivo
  const [pendingList, setPendingList] = useState<PendingParticipant[]>([]);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [queueSortOrder, setQueueSortOrder] = useState<"FIFO" | "RECENT">("FIFO");

  const rotationRef = useRef<number>(0);
  const stopTickerRef = useRef<(() => void) | null>(null);
  const [tickerCount, setTickerCount] = useState<number>(0);
  const prevPendingCountRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (stopTickerRef.current) {
        stopTickerRef.current();
        stopTickerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("finora_operator_session");
      if (stored) setOperatorUser(JSON.parse(stored));
    } catch {}
    setCheckedAuth(true);
  }, []);

  async function handleOperatorLogin(e: React.FormEvent) {
    e.preventDefault();
    setOperatorLoginError(null);
    setOperatorLoginLoading(true);

    try {
      const res = await fetch("/finora-experience/api/admin-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: operatorUsername, password: operatorPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Credenciais inválidas de operador.");
      }

      const user = data.user || { name: "Operador Finora", role: "ADMIN" };
      setOperatorUser(user);
      window.localStorage.setItem("finora_operator_session", JSON.stringify(user));
      setOperatorPassword("");
      // A fila carregada antes do login voltou 401; recarrega já com a sessão.
      loadPendingQueue();
    } catch (err) {
      setOperatorLoginError(err instanceof Error ? err.message : "Erro ao realizar login.");
    } finally {
      setOperatorLoginLoading(false);
    }
  }

  function handleOperatorLogout() {
    setOperatorUser(null);
    window.localStorage.removeItem("finora_operator_session");
  }

  // Cartão VIP gira só o pool VIP; demais giros nunca mostram prêmio VIP (espelha a API).
  const isVipSpin = Boolean(selected?.vip);

  const wheelPrizes = useMemo(() => {
    const pool = prizes.filter((prize) => Boolean(prize.is_vip) === isVipSpin);
    const candidatePrizes = pool.length > 0 ? pool : prizes;
    const eligible = candidatePrizes.filter((prize) => prize.active && prize.available_stock > 0);
    return eligible.length > 0 ? eligible : candidatePrizes;
  }, [prizes, isVipSpin]);

  const loadPendingQueue = useCallback(async () => {
    try {
      const res = await fetch(`${getAdminProxyUrl()}/participants/pending-draws?eventId=${activeEventId}`, { cache: "no-store" });
      if (res.status === 401) {
        // Sessão do operador expirou: volta para o login da roleta
        setOperatorUser(null);
        window.localStorage.removeItem("finora_operator_session");
        return;
      }
      if (!res.ok) throw new Error(`Não foi possível carregar a fila (${res.status}).`);
      const data = await res.json();
      const newList = Array.isArray(data) ? data : data?.participants || data?.data || [];
      if (!Array.isArray(newList)) throw new Error("A fila retornou um formato inválido.");
      if (newList.length > prevPendingCountRef.current && prevPendingCountRef.current > 0 && soundEnabled) {
        playChimeSound();
      }
      prevPendingCountRef.current = newList.length;
      setPendingList(newList);
      setQueueError(null);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : "Não foi possível carregar a fila.");
    }
  }, [activeEventId, soundEnabled]);

  function selectParticipant(p: PendingParticipant) {
    setSelected(p);
    setParticipationId(p.participationId);
    setParticipantName(p.fullName);
    setParticipantInfo(
      [p.clinicName, p.croNumber ? `CRO ${p.croNumber}/${p.croState || ""}` : "", p.city ? `${p.city}/${p.state || ""}` : ""]
        .filter(Boolean)
        .join(" · "),
    );
    setIsDemoSpin(false);
    setResult(null);
    setIsParticipantConfirmed(false);
    setPhase("READY");
  }

  function startDemoMode() {
    setSelected(null);
    setParticipationId(null);
    setParticipantName("Teste");
    setParticipantInfo("");
    setIsDemoSpin(true);
    setResult(null);
    setIsParticipantConfirmed(true);
    setPhase("READY");
  }

  function returnToQueue() {
    setResult(null);
    setSelected(null);
    setParticipationId(null);
    setParticipantName("");
    setParticipantInfo("");
    setIsDemoSpin(false);
    setIsParticipantConfirmed(false);
    setError(null);
    setPhase("READY");
    // Avisos que chegaram durante o giro foram ignorados: atualiza a fila agora.
    loadPendingQueue();
  }

  useEffect(() => {
    async function init() {
      const apiUrl = getApiBaseUrl();
      try {
        const prizesRes = await fetch(`${apiUrl}/prizes/event/${activeEventId}`, { cache: "no-store" });
        if (prizesRes.ok) {
          const prizesData = await prizesRes.json();
          setPrizes(Array.isArray(prizesData) ? prizesData : []);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const queryPartId = Number(urlParams.get("participation") || urlParams.get("pin"));
        const queryVip = urlParams.get("vip");

        if (queryPartId > 0) {
          try {
            const partRes = await fetch(`${apiUrl}/participants/${queryPartId}/public`, { cache: "no-store" });
            if (partRes.ok) {
              const partData = await partRes.json();
              const isVipUser = Boolean(partData.isVip || partData.vipCode);
              const displayName = partData.participant.fullName || partData.participant.firstName || "Participante";

              if (partData.draw) {
                setResult({
                  success: true,
                  alreadyDrawn: true,
                  draw: { id: partData.draw.id, source: partData.draw.source, drawnAt: partData.draw.drawn_at },
                  participation: { id: partData.id, status: partData.status },
                  participant: { id: partData.participant.id, name: displayName },
                  prize: {
                    id: partData.draw.prizes.id,
                    name: partData.draw.prizes.name,
                    description: partData.draw.prizes.description,
                    imageUrl: partData.draw.prizes.image_url,
                  },
                });
                setParticipantName(displayName);
                setPhase("RESULT");
                return;
              }

              setParticipationId(partData.id);
              setParticipantName(displayName);
              setParticipantInfo(
                [
                  isVipUser ? "🌟 Bilhete Dourado / VIP" : null,
                  partData.hasScheduledMeeting ? "📅 Bate-papo VIP Agendado" : null,
                  partData.participant.clinicName,
                  partData.participant.croNumber ? `CRO ${partData.participant.croNumber}/${partData.participant.croState || ""}` : null,
                  partData.participant.city ? `${partData.participant.city}/${partData.participant.state || ""}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              );

              setSelected({
                participationId: partData.id,
                participantId: partData.participant.id,
                vip: isVipUser,
                fullName: displayName,
                cpfLastDigits: "",
                phone: "",
                clinicName: partData.participant.clinicName || null,
                croNumber: partData.participant.croNumber || null,
                croState: partData.participant.croState || null,
                city: partData.participant.city || null,
                state: partData.participant.state || null,
                createdAt: new Date().toISOString(),
              });

              setIsParticipantConfirmed(false);
            }
          } catch {}
        }

        await loadPendingQueue();
        setPhase("READY");
      } catch {
        setError("Não foi possível carregar a experiência da roleta.");
        setPhase("ERROR");
      }
    }

    init();
  }, [loadPendingQueue]);

  // Fila do operador: atualiza quando alguém se cadastra/valida (SSE), sem polling de 3,5s.
  useLiveEvent(activeEventId, () => {
    if (phase === "READY" && !participationId) loadPendingQueue();
  }, 30_000);

  // Resultado volta sozinho ao modo operador.
  useEffect(() => {
    if (phase !== "RESULT") return;
    setResetIn(RESULT_RESET_S);
    const t = setInterval(() => setResetIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "RESULT" && resetIn <= 0) returnToQueue();
  }, [phase, resetIn]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setSoundEnabled((s) => !s);
        return;
      }

      if (e.code === "Space" || e.code === "Enter") {
        if (phase === "READY" && isParticipantConfirmed) {
          e.preventDefault();
          handleSpin();
        } else if (phase === "RESULT") {
          e.preventDefault();
          returnToQueue();
        }
      } else if (e.code === "Escape" && (phase === "READY" || phase === "RESULT")) {
        e.preventDefault();
        returnToQueue();
      } else if (e.key === "/" && !isParticipantConfirmed && phase === "READY") {
        e.preventDefault();
        const searchInput = document.getElementById("busca") as HTMLInputElement | null;
        searchInput?.focus();
      } else if (!isParticipantConfirmed && phase === "READY" && /^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (filteredPending[idx]) {
          e.preventDefault();
          selectParticipant(filteredPending[idx]);
          setIsParticipantConfirmed(true);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  async function handleSpin() {
    if (phase === "DRAWING" || wheelPrizes.length === 0) return;

    setPhase("DRAWING");
    setError(null);
    triggerHaptic();

    try {
      let targetPrizeId: number;
      let drawResponseData: DrawResponse;

      if (isDemoSpin || !participationId) {
        const demoPrize = wheelPrizes[Math.floor(Math.random() * wheelPrizes.length)];
        targetPrizeId = demoPrize.id;
        drawResponseData = {
          success: true,
          draw: { id: 9999, source: "AUTOMATIC", drawnAt: new Date().toISOString() },
          participation: { id: 9999, status: "APPROVED" },
          participant: { id: 9999, name: participantName || "Visitante Finora" },
          prize: { id: demoPrize.id, name: demoPrize.name, description: demoPrize.description, imageUrl: demoPrize.image_url },
        };
      } else {
        const res = await fetch(`${getApiBaseUrl()}/draws/participation/${participationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro ao realizar sorteio.");
        drawResponseData = data;
        targetPrizeId = data.prize.id;
      }

      const prizeIndex = Math.max(0, wheelPrizes.findIndex((p) => p.id === targetPrizeId));
      const sliceDeg = 360 / wheelPrizes.length;
      // Fatia i é centrada em i * sliceDeg; precisa terminar sob o ponteiro (0°).
      const targetDeg = (360 - prizeIndex * sliceDeg) % 360;
      const current = ((rotationRef.current % 360) + 360) % 360;
      const finalRotation = rotationRef.current + 8 * 360 + ((targetDeg - current + 360) % 360);

      rotationRef.current = finalRotation;
      setRotation(finalRotation);

      if (stopTickerRef.current) {
        stopTickerRef.current();
      }
      stopTickerRef.current = startPhysicsTicker(SPIN_MS, soundEnabled, () => {
        setTickerCount((c) => c + 1);
      });

      setTimeout(() => {
        if (stopTickerRef.current) {
          stopTickerRef.current();
          stopTickerRef.current = null;
        }

        if (soundEnabled) {
          playSlowdownSound();
          playWinFanfare();
          speakWinner(drawResponseData.participant.name, drawResponseData.prize.name);
        }

        const rarity = getPrizeRarity(drawResponseData.prize.name);
        fireVictoryCelebration(eventAccent(), rarity === "COMMON" ? "#0077FF" : RARITY[rarity].color);

        setResult(drawResponseData);
        setPhase("RESULT");
      }, SPIN_MS);
    } catch (err) {
      if (stopTickerRef.current) {
        stopTickerRef.current();
        stopTickerRef.current = null;
      }
      setError(err instanceof Error ? err.message : "Erro ao processar giro.");
      setPhase("READY");
    }
  }

  const filteredPending = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
    let list = pendingList;
    if (q) {
      list = pendingList.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.cpfLastDigits.includes(q) ||
          String(p.participantId).padStart(4, "0").includes(q) ||
          String(p.participationId).includes(q) ||
          (p.clinicName && p.clinicName.toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime() || a.participationId;
      const timeB = new Date(b.createdAt || 0).getTime() || b.participationId;
      return queueSortOrder === "FIFO" ? timeA - timeB : timeB - timeA;
    });
  }, [pendingList, searchQuery, queueSortOrder]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }

  const nameParts = participantName.trim().split(/\s+/);
  const firstName =
    (nameParts[0]?.toLowerCase().startsWith("dr") && nameParts.length > 1)
      ? `${nameParts[0]} ${nameParts[1]}`
      : nameParts[0] || "Participante";
  const iconButton = "flex size-11 items-center justify-center rounded-xl border border-ink-line text-ink-text";

  // ---------- Login do operador ----------
  if (checkedAuth && !operatorUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <form onSubmit={handleOperatorLogin} className="flex w-full max-w-md flex-col gap-5 rounded-card border border-ink-line bg-ink-800 p-8">
          <span className="self-start rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-ink-950">Modo operador</span>
          <h1 className="font-display text-[34px] font-bold leading-tight tracking-[-0.02em]">Entrar para liberar a roleta</h1>
          <label className="flex flex-col gap-2 text-[15px] font-semibold text-ink-text-2">
            Usuário
            <input
              required
              value={operatorUsername}
              onChange={(e) => setOperatorUsername(e.target.value)}
              className="h-14 rounded-field border border-ink-line bg-ink-900/90 px-4 text-lg font-medium text-white outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(var(--accent-rgb),0.35)] transition-all"
            />
          </label>
          <label className="flex flex-col gap-2 text-[15px] font-semibold text-ink-text-2">
            Senha
            <input
              type="password"
              required
              value={operatorPassword}
              onChange={(e) => setOperatorPassword(e.target.value)}
              className="h-14 rounded-field border border-ink-line bg-ink-900/90 px-4 text-lg font-medium text-white outline-none focus:border-accent focus:shadow-[0_0_20px_rgba(var(--accent-rgb),0.35)] transition-all"
            />
          </label>
          {operatorLoginError && (
            <p role="alert" className="flex items-center gap-2 font-semibold text-[#FF8FA3]">
              <CircleAlert size={18} /> {operatorLoginError}
            </p>
          )}
          <button
            type="submit"
            disabled={operatorLoginLoading}
            className="flex h-16 items-center justify-center gap-2 rounded-full bg-accent text-xl font-bold text-ink-950 disabled:opacity-60"
          >
            {operatorLoginLoading ? <LoaderCircle size={22} className="animate-spin" /> : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  // ---------- Resultado ----------
  if (phase === "RESULT" && result) {
    const rarity = getPrizeRarity(result.prize.name);
    const image = result.prize.imageUrl || result.prize.image_url;
    return (
      <div className="relative h-dvh max-h-dvh w-full overflow-hidden flex flex-col justify-between items-center px-4 py-3 sm:py-5 select-none text-center">
        {/* Fundo com grade cibernética e aura de vitória leve */}
        <div className="cyber-grid-overlay pointer-events-none" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none opacity-40"
          style={{ background: "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 70%)" }}
        />

        {/* Topo Compacto */}
        <div className="flex-none w-full max-w-4xl flex items-center justify-between z-10 px-2">
          <div className="flex items-center gap-3">
            <FinoraLogo className="text-[20px] sm:text-[24px]" />
            <span className="font-mono text-xs tracking-[0.08em] text-accent uppercase hidden sm:inline">{event?.label}</span>
          </div>
          <button
            type="button"
            onClick={returnToQueue}
            aria-label="Fechar resultado e voltar à fila"
            className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-ink-line bg-ink-800/80 text-ink-text hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Centro: Prêmio e Card Holográfico */}
        <div className="flex-1 min-h-0 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-4 z-10 my-auto py-1">
          <div className="animate-pop-burst flex flex-col items-center gap-1.5 sm:gap-2">
            <RarityBadge rarity={rarity} prefix="Prêmio " className="text-sm sm:text-base shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
            <h1 className="font-display text-[clamp(28px,5vw,56px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
              Você ganhou
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white">
                {result.prize.name}
              </span>
            </h1>
          </div>

          <div className="holographic-card flex flex-col sm:grid sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] w-full max-w-[540px] overflow-hidden rounded-2xl border border-accent/40 bg-ink-800/95 backdrop-blur-xl text-left shadow-[0_16px_50px_rgba(0,0,0,0.6),0_0_35px_rgba(var(--accent-rgb),0.25)]">
            <div className="flex items-center justify-center bg-ink-700/80 p-3 sm:p-4 border-b sm:border-b-0 sm:border-r border-ink-line min-h-[110px] sm:min-h-0">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="max-h-28 sm:max-h-36 w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-float-slow" />
              ) : (
                <span className="text-sm font-semibold text-accent text-center">{result.prize.description || "Brinde Finora"}</span>
              )}
            </div>
            <div className="flex flex-col justify-center gap-2 sm:gap-3 p-4 sm:p-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] sm:text-xs font-medium text-ink-text-2 uppercase tracking-wider">Retire no balcão com o código</span>
                <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.06em] text-accent drop-shadow-[0_0_18px_rgba(var(--accent-rgb),0.6)]">
                  {code(selected?.participantId ?? result.participant.id)}
                </span>
              </div>
              <span className="flex items-center gap-2 text-xs sm:text-sm font-medium text-ink-text">
                <Check size={16} strokeWidth={2.4} className="text-[#4ADE80] drop-shadow-[0_0_10px_rgba(74,222,128,0.5)] flex-none" />
                <span>Cupom do Sorteio Geral garantido!</span>
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé Compacto */}
        <div className="flex-none flex flex-col sm:flex-row items-center gap-2 sm:gap-4 z-10 pb-1">
          <button
            type="button"
            onClick={returnToQueue}
            className="flex h-13 sm:h-15 items-center rounded-full bg-accent px-8 sm:px-10 text-base sm:text-lg font-bold text-ink-950 shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            Concluir [Espaço]
          </button>
          <span className="text-xs sm:text-sm font-mono text-ink-text-2">Retorna à fila em {Math.max(resetIn, 0)}s</span>
        </div>
      </div>
    );
  }

  // ---------- Visitante gira ----------
  if (isParticipantConfirmed && (phase === "READY" || phase === "DRAWING")) {
    const spinning = phase === "DRAWING";
    return (
      <div className="relative h-dvh max-h-dvh w-full overflow-hidden flex flex-col justify-between items-center px-4 py-2.5 sm:py-4 select-none landscape:grid landscape:grid-cols-[minmax(0,56%)_minmax(0,1fr)] landscape:items-center landscape:gap-10 landscape:px-12 landscape:py-6">
        {/* Efeito de ambiente futurista leve */}
        <div className="cyber-grid-overlay pointer-events-none opacity-40" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 70%)" }}
        />

        {/* Barra superior: Logotipo, Identificação do Participante e Controles */}
        <div className="flex-none w-full max-w-5xl h-10 sm:h-11 flex items-center justify-between z-20 px-1">
          <div className="flex items-center gap-3">
            <FinoraLogo className="text-[19px] sm:text-[23px]" />
            <span className="font-mono text-xs tracking-[0.08em] text-accent uppercase hidden sm:inline">{event?.label}</span>
          </div>

          {/* Badge superior compacto do participante (visível em telas verticais) */}
          <div className="flex items-center gap-2 rounded-full border border-ink-line/80 bg-ink-800/90 px-3.5 py-1 shadow-md backdrop-blur landscape:hidden">
            {isVipSpin ? (
              <span className="flex items-center gap-1.5 font-mono text-xs font-black text-[#FFDF73] uppercase tracking-wider">
                <Crown size={13} className="text-[#FFDF73]" /> VIP Dourado
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-accent uppercase tracking-wider">
                <Sparkles size={13} /> {spinning ? "Girando" : "Giro Liberado"}
              </span>
            )}
            <span className="h-3 w-px bg-ink-line" />
            <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] sm:max-w-[180px]">
              {spinning ? "Boa sorte!" : isDemoSpin ? "Modo Teste" : firstName}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              aria-label={soundEnabled ? "Desligar som" : "Ligar som"}
              className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-ink-line bg-ink-800/80 text-ink-text hover:text-white transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label="Tela cheia"
              className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-ink-line bg-ink-800/80 text-ink-text hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
            <button
              type="button"
              onClick={returnToQueue}
              disabled={spinning}
              aria-label="Voltar ao modo operador"
              title="Voltar ao modo operador"
              className="flex size-9 sm:size-10 items-center justify-center rounded-xl border border-ink-line bg-ink-800/80 text-ink-text hover:text-white transition-colors disabled:invisible cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Coluna da Roleta: Perfeitamente Centralizada e Proporcionada */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center relative my-auto z-10 px-2 py-1 landscape:h-full">
          <div className="relative flex items-center justify-center w-full aspect-square max-w-[min(90vw,calc(100dvh-175px),520px)] landscape:max-w-[min(720px,84dvh)]">
            <div
              className="absolute -inset-4 rounded-full pointer-events-none opacity-30"
              style={{ background: "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 75%)" }}
            />
            <Wheel
              names={wheelPrizes.map((p) => p.name)}
              rotation={rotation}
              spinning={spinning}
              durationMs={SPIN_MS}
              tickerCount={tickerCount}
              onSpin={handleSpin}
            />
          </div>
        </div>

        {/* Em modo vertical, o botão fica Imediatamente Visível Sem Rolagem */}
        <div className="flex-none w-full max-w-sm flex flex-col items-center gap-1.5 pb-1 sm:pb-2 z-20 landscape:hidden">
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning}
            className={`w-full h-14 sm:h-16 rounded-full text-xl sm:text-2xl font-black active:scale-[0.98] transition-all cursor-pointer shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center justify-center gap-2.5 ${
              isVipSpin
                ? "bg-gradient-to-r from-[#FFE57F] via-[#FFD54F] to-[#FFC107] text-[#3E2723] shadow-[0_10px_35px_rgba(255,213,79,0.55)] hover:brightness-110 animate-pulse-glow"
                : "bg-accent text-ink-950 shadow-[0_10px_35px_rgba(var(--accent-rgb),0.55)] hover:brightness-105 animate-pulse-glow"
            }`}
          >
            {spinning ? (
              <>
                <LoaderCircle size={22} className="animate-spin text-ink-950" />
                <span>Girando a roleta…</span>
              </>
            ) : (
              <>
                <span>{isVipSpin ? "GIRAR ROLETA VIP 🌟" : "GIRAR A ROLETA"}</span>
                <ArrowRight size={22} className="animate-pulse" />
              </>
            )}
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono text-ink-text-2">
            <kbd className="px-2 py-0.5 rounded bg-ink-800 border border-ink-line text-[11px] font-bold text-accent">[Espaço]</kbd>
            <span>ou toque na roleta para girar</span>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-[#FF8FA3]">
              <CircleAlert size={14} /> {error}
            </p>
          )}
        </div>

        {/* Coluna Lateral no Landscape: Compacta, Nobre, com Botão Imediato */}
        <div className="hidden landscape:flex flex-col justify-center gap-6 z-10 w-full max-w-md">
          {isVipSpin && (
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/30 to-[#996515]/30 px-4 py-1.5 shadow-[0_0_25px_rgba(212,175,55,0.4)] animate-pulse-glow shrink-0 whitespace-nowrap">
              <Crown size={18} className="text-[#FFDF73] animate-bounce shrink-0" />
              <span className="font-mono text-xs font-black tracking-widest text-[#FFDF73] uppercase whitespace-nowrap">
                BILHETE DOURADO · POOL VIP
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-xs tracking-widest text-accent uppercase font-bold">
              {spinning ? "SORTEIO EM ANDAMENTO" : isDemoSpin ? "MODO DEMONSTRAÇÃO" : "PARTICIPANTE LIBERADO"}
            </span>
            <h1 className="font-display text-[clamp(32px,3.8vw,48px)] font-black text-white leading-tight">
              {spinning ? "Boa sorte!" : isDemoSpin ? "Giro de Teste" : `${firstName}, é a sua vez!`}
            </h1>
            <p className="text-sm sm:text-base text-ink-text-2">
              {isVipSpin ? "Pool exclusivo com prêmios nobres de mentorado." : "100% dos giros ganham brindes no balcão."}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={handleSpin}
              disabled={spinning}
              className={`w-full h-20 sm:h-22 rounded-full text-2xl sm:text-[26px] font-black active:scale-[0.98] transition-all cursor-pointer shadow-2xl flex items-center justify-center gap-3 ${
                isVipSpin
                  ? "bg-gradient-to-r from-[#FFE57F] via-[#FFD54F] to-[#FFC107] text-[#3E2723] shadow-[0_12px_45px_rgba(255,213,79,0.6)] hover:brightness-110 animate-pulse-glow"
                  : "bg-accent text-ink-950 shadow-[0_10px_40px_rgba(var(--accent-rgb),0.55)] hover:brightness-105 animate-pulse-glow"
              }`}
            >
              {spinning ? (
                <>
                  <LoaderCircle size={26} className="animate-spin text-ink-950" />
                  <span>Girando a roleta…</span>
                </>
              ) : (
                <>
                  <span>{isVipSpin ? "GIRAR ROLETA VIP 🌟" : "GIRAR A ROLETA"}</span>
                  <ArrowRight size={26} className="animate-pulse" />
                </>
              )}
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-ink-text-2">
              <kbd className="px-2 py-0.5 rounded bg-ink-800 border border-ink-line text-[11px] font-bold text-accent">[Espaço]</kbd>
              <span>ou clique diretamente na roleta para girar</span>
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 font-semibold text-[#FF8FA3]">
              <CircleAlert size={18} /> {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Operador escolhe quem gira ----------
  return (
    <div className="flex min-h-dvh flex-col bg-ink-950">
      <div className="flex h-16 items-center justify-between gap-4 border-b border-ink-line bg-ink-900/90 backdrop-blur px-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="inline-flex flex-none items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[13px] font-bold text-ink-950">
            <UserRound size={14} strokeWidth={2.4} /> Modo operador
          </span>
          <span className="truncate text-[15px] text-ink-text-2">
            {operatorUser?.name || "Operador"} · {event?.label}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-3 rounded-full border border-ink-line/80 bg-ink-800/80 px-4 py-1.5 shadow-inner">
          <Target size={15} className="text-accent" />
          <span className="font-mono text-xs font-bold text-slate-200">
            Aguardando Giro: <span className="text-accent font-extrabold">{pendingList.length}</span>
          </span>
          <span className="h-3 w-px bg-ink-line" />
          <span className="font-mono text-xs text-slate-300">
            Prêmios no Pool: <span className="text-white font-bold">{prizes.length}</span>
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSoundEnabled(!soundEnabled)} aria-label={soundEnabled ? "Desligar som" : "Ligar som"} className={iconButton}>
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label="Tela cheia" className={iconButton}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button type="button" onClick={handleOperatorLogout} className="flex h-11 items-center gap-2 rounded-xl border border-ink-line px-4 text-[15px] font-semibold hover:bg-white/5 transition-colors">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_460px]">
        {/* Coluna da Fila e Busca */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[34px] sm:text-[40px] font-black tracking-tight text-white">
              Quem vai girar?
            </h1>
            <p className="text-sm text-ink-text-2">
              Digite o código PIN (#0045), nome ou CPF para localizar o participante.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {/* Campo de Busca Escuro e Elegante */}
            <div className="group relative flex h-16 items-center gap-3.5 rounded-2xl border-2 border-ink-line bg-ink-800/80 px-5 shadow-inner transition-all focus-within:border-accent focus-within:bg-ink-800 focus-within:shadow-[0_0_25px_rgba(var(--accent-rgb),0.25)]">
              <Search size={22} className="text-accent flex-none transition-transform group-focus-within:scale-110" />
              <input
                id="busca"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="#0045, Ana, Clínica…"
                className="min-w-0 flex-1 bg-transparent font-mono text-xl font-bold text-white outline-none placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:text-slate-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="flex size-7 items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-ink-text-2 font-mono gap-1 px-1">
              <span>Atalhos: [1-9] Selecionar · [/] Buscar</span>
              <span>[Espaço] Girar · [F] Tela Cheia</span>
            </div>
          </div>

          <div className="mt-2 flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-line pb-2 mb-2">
              <span className="font-mono text-xs tracking-[0.08em] text-ink-text-2 uppercase font-semibold">
                FILA DE GIRO · {pendingList.length}
              </span>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg bg-ink-950 p-0.5 border border-ink-line text-[11px] font-mono">
                  <button
                    type="button"
                    onClick={() => setQueueSortOrder("FIFO")}
                    title="Quem chegou primeiro na fila física gira primeiro (Ordem de chegada)"
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      queueSortOrder === "FIFO" ? "bg-accent text-ink-950 shadow-sm" : "text-ink-text-2 hover:text-white"
                    }`}
                  >
                    Ordem de Chegada
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueueSortOrder("RECENT")}
                    title="Quem acabou de se cadastrar aparece no topo"
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      queueSortOrder === "RECENT" ? "bg-accent text-ink-950 shadow-sm" : "text-ink-text-2 hover:text-white"
                    }`}
                  >
                    Mais Recentes
                  </button>
                </div>
                <button
                  type="button"
                  onClick={startDemoMode}
                  className="text-xs font-mono font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer ml-1"
                >
                  <Play size={12} fill="currentColor" /> Teste
                </button>
              </div>
            </div>

            {queueError && <p className="py-3 text-[#FF8FA3]">{queueError}</p>}
            {phase === "LOADING" ? (
              <span className="flex items-center gap-2 py-6 text-ink-text-2">
                <LoaderCircle size={18} className="animate-spin" /> Carregando fila…
              </span>
            ) : filteredPending.length === 0 ? (
              <div className="py-8 text-center text-ink-text-2 rounded-xl border border-dashed border-ink-line/60 bg-ink-900/30">
                <p>{searchQuery ? "Nenhum participante encontrado com essa busca." : "Ninguém aguardando giro agora."}</p>
                <p className="text-xs text-slate-500 mt-1">Os novos cadastros aparecem aqui em tempo real.</p>
              </div>
            ) : (
              <ul className="max-h-[50dvh] overflow-y-auto divide-y divide-ink-line/40 rounded-xl border border-ink-line/60 bg-ink-900/40">
                {filteredPending.slice(0, 30).map((p, idx) => {
                  const on = selected?.participationId === p.participationId;
                  const shortcutKey = idx < 9 ? idx + 1 : null;
                  return (
                    <li key={p.participationId}>
                      <button
                        type="button"
                        onClick={() => selectParticipant(p)}
                        aria-pressed={on}
                        className={`grid w-full grid-cols-[auto_85px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left text-base transition-all hover:bg-ink-800/90 ${
                          on ? "bg-accent/15 border-l-4 border-accent text-white" : "text-slate-200"
                        }`}
                      >
                        {shortcutKey ? (
                          <span className="flex size-6 items-center justify-center rounded-md bg-ink-700/80 border border-ink-line text-[11px] font-mono font-bold text-accent">
                            {shortcutKey}
                          </span>
                        ) : (
                          <span className="size-6" />
                        )}
                        <span className="font-mono font-bold text-accent">{code(p.participantId)}</span>
                        <span className="truncate font-medium">
                          {p.vip && (
                            <span className="mr-2 rounded-full bg-accent px-2 py-0.5 font-mono text-xs font-bold text-ink-950">VIP</span>
                          )}
                          {p.fullName}
                          {p.clinicName ? ` · ${p.clinicName}` : ""}
                        </span>
                        <span className="text-ink-text-2 text-xs font-mono">{minutesAgo(p.createdAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Coluna Direita: Ficha de Confirmação ou Painel de Controle Rápido */}
        <div className="flex flex-col gap-5 rounded-card border border-ink-line bg-ink-800/90 backdrop-blur p-7 shadow-xl">
          {participationId ? (
            <>
              <div className="flex items-center justify-between border-b border-ink-line pb-4">
                <span className="font-mono text-xs tracking-[0.08em] text-accent font-bold uppercase">PARTICIPANTE ENCONTRADO</span>
                {isVipSpin && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37] bg-[#D4AF37]/20 px-3 py-1 font-mono text-xs font-black text-[#FFDF73]">
                    <Crown size={14} /> VIP DOURADO
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[32px] sm:text-[36px] font-black leading-tight tracking-tight text-white">{participantName}</span>
                {participantInfo && <span className="text-[16px] text-ink-text-2 font-medium">{participantInfo}</span>}
              </div>

              <ul className="flex flex-col gap-2.5 rounded-xl bg-ink-900/60 p-4 border border-ink-line">
                {["Cadastro validado no sistema", isVipSpin ? "1 giro exclusivo no Pool VIP" : "1 giro oficial no estande"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm font-semibold text-slate-200">
                    <Check size={18} strokeWidth={2.6} className="text-[#4ADE80] flex-none" />
                    {t}
                  </li>
                ))}
              </ul>

              <div className="flex-1 min-h-6" />

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setIsParticipantConfirmed(true)}
                  aria-label={`Liberar roleta para ${firstName}`}
                  className="flex h-17 items-center justify-center gap-2.5 rounded-full bg-accent px-6 text-xl font-black text-ink-950 active:scale-[0.98] shadow-[0_8px_30px_rgba(var(--accent-rgb),0.4)] hover:brightness-105 transition-all cursor-pointer"
                >
                  <span>Liberar Roleta para {firstName}</span>
                  <ArrowRight size={22} strokeWidth={2.4} />
                </button>
                <div className="flex items-center justify-between px-2 text-xs font-mono text-ink-text-2">
                  <span>Atalho: [Enter] para liberar</span>
                  <button type="button" onClick={returnToQueue} className="hover:text-white underline underline-offset-2">
                    Escolher outra pessoa
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 p-4 text-center">
              <div className="relative flex size-24 items-center justify-center rounded-full border-2 border-accent/40 bg-gradient-to-br from-accent/20 via-blue-500/10 to-transparent shadow-[0_0_35px_rgba(var(--accent-rgb),0.2)]">
                <Sparkles size={36} className="text-accent animate-pulse" />
              </div>

              <div className="flex flex-col gap-1.5 max-w-[300px]">
                <h3 className="text-xl font-bold text-white">Pronto para o Próximo Giro</h3>
                <p className="text-sm text-ink-text-2 leading-relaxed">
                  Selecione alguém na fila à esquerda ou clique abaixo para testar a roleta ao vivo.
                </p>
              </div>

              <button
                type="button"
                onClick={startDemoMode}
                className="mt-2 flex h-14 items-center gap-2.5 rounded-full bg-accent px-8 text-base font-bold text-ink-950 shadow-[0_0_25px_rgba(var(--accent-rgb),0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Play size={18} fill="currentColor" />
                <span>Abrir Roleta em Modo Teste</span>
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 font-semibold text-[#FF8FA3]">
              <CircleAlert size={18} /> {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ClinicorpRouletteExperience;
