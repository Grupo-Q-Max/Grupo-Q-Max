"use client";

import { ArrowRight, Check, CircleAlert, Crown, LoaderCircle, Lock, LogOut, Maximize, Minimize, Play, Search, Sparkles, Target, UserRound, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { QRCodeSVG } from "qrcode.react";
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
  vip?: boolean;
  isDualDraw?: boolean;
  draw: { id: number; source: "QUEUE" | "AUTOMATIC"; drawnAt: string };
  vipDraw?: { id: number; source: "QUEUE" | "AUTOMATIC"; drawnAt: string } | null;
  participation: { id: number; status: string };
  participant: { id: number; name: string };
  prize: DrawPrize;
  vipPrize?: DrawPrize | null;
};

type PendingParticipant = {
  participationId: number;
  participantId: number;
  vip?: boolean;
  hasMeeting?: boolean;
  pendingVipOnly?: boolean;
  normalPrize?: { id: number; name: string; description?: string | null; imageUrl?: string | null; image_url?: string | null };
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

function cleanPrizeName(name?: string | null): string {
  if (!name) return "";
  const lower = name.toLowerCase().trim();
  if (lower.includes("garrafa")) return "Garrafa";
  if (lower.includes("copo")) return "Copo";
  return name;
}

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
  const [rotationNormal, setRotationNormal] = useState<number>(0);
  const [rotationVip, setRotationVip] = useState<number>(0);
  const [result, setResult] = useState<DrawResponse | null>(null);

  // Sequência de Giros VIP: Normal primeiro -> Botão Roleta VIP -> Roleta VIP -> Suspense -> Parabéns
  type VipSpinStage = "READY_NORMAL" | "SPINNING_NORMAL" | "WAITING_VIP" | "SPINNING_VIP" | "SUSPENSE";
  const [vipSpinStage, setVipSpinStage] = useState<VipSpinStage>("READY_NORMAL");
  const [storedDrawResponse, setStoredDrawResponse] = useState<DrawResponse | null>(null);
  const [normalWonPrize, setNormalWonPrize] = useState<DrawPrize | null>(null);
  const [suspenseStatus, setSuspenseStatus] = useState<string>("");
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
  const rotationNormalRef = useRef<number>(0);
  const rotationVipRef = useRef<number>(0);
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

  // Usuário VIP: possui código VIP cadastrado OU agendou reunião na área de cadastro
  const isVipSpin = Boolean(selected?.vip);

  // Monitora a cada 3 segundos se o participante agendou pelo QR Code do celular para liberar a Roleta VIP em tempo real
  useEffect(() => {
    if (isVipSpin || !participationId || phase === "RESULT") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/participants/${participationId}/public`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.isVip || data.hasScheduledMeeting || data.vipCode) {
            setSelected((prev) => (prev ? { ...prev, vip: true } : prev));
            if (soundEnabled) playChimeSound();
            confetti({
              particleCount: 50,
              spread: 80,
              origin: { x: 0.75, y: 0.5 },
              colors: ["#FFD700", "#FFA500", "#FFFFFF"],
            });
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [isVipSpin, participationId, phase, soundEnabled]);

  const normalPrizes = useMemo(() => {
    const pool = prizes.filter((prize) => !prize.is_vip && !prize.name.toLowerCase().includes("pin"));
    const eligible = pool.filter((prize) => prize.active && prize.available_stock > 0);
    const target = eligible.length > 0 ? eligible : pool;
    return target.map((p) => ({ ...p, name: cleanPrizeName(p.name) }));
  }, [prizes]);

  const vipPrizes = useMemo(() => {
    // Mantém todos os prêmios VIP ativos visíveis nas fatias da roleta (incluindo o de 50% de desconto)
    const pool = prizes.filter((prize) => Boolean(prize.is_vip) && prize.active);
    return pool.length > 0 ? pool : prizes.filter((prize) => Boolean(prize.is_vip));
  }, [prizes]);

  const wheelPrizes = normalPrizes;

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

    if (p.pendingVipOnly && p.normalPrize) {
      setNormalWonPrize({
        id: p.normalPrize.id,
        name: cleanPrizeName(p.normalPrize.name),
        description: p.normalPrize.description || null,
        imageUrl: p.normalPrize.imageUrl || p.normalPrize.image_url || null,
      });
      setVipSpinStage("WAITING_VIP");
      setIsParticipantConfirmed(true);
      setParticipantInfo("🌟 Já realizou o giro normal · ROLETA VIP LIBERADA!");
      setStoredDrawResponse(null);
      setPhase("READY");
    } else {
      setVipSpinStage("READY_NORMAL");
      setStoredDrawResponse(null);
      setNormalWonPrize(null);
      setSuspenseStatus("");
      setIsParticipantConfirmed(false);
      setPhase("READY");
    }
  }

  function startDemoMode(asVip = false) {
    setSelected(asVip ? {
      participationId: 0,
      participantId: 0,
      vip: true,
      fullName: "Demonstração VIP",
      cpfLastDigits: "0000",
      phone: "0000",
      clinicName: "Clínica VIP",
      croNumber: null,
      croState: null,
      city: null,
      state: null,
      createdAt: new Date().toISOString(),
    } : null);
    setParticipationId(null);
    setParticipantName(asVip ? "Visitante VIP" : "Teste");
    setParticipantInfo(asVip ? "🌟 Bilhete VIP · Dupla Roleta Liberada" : "Giro de Demonstração");
    setIsDemoSpin(true);
    setResult(null);
    setVipSpinStage("READY_NORMAL");
    setStoredDrawResponse(null);
    setNormalWonPrize(null);
    setSuspenseStatus("");
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
    setVipSpinStage("READY_NORMAL");
    setStoredDrawResponse(null);
    setNormalWonPrize(null);
    setSuspenseStatus("");
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
          setPrizes(
            (Array.isArray(prizesData) ? prizesData : []).map((p: any) => ({
              ...p,
              name: cleanPrizeName(p.name),
            }))
          );
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
                const isVipEligible = Boolean(partData.isVip || partData.hasScheduledMeeting || partData.vipCode);
                const hasPendingVipSpin = isVipEligible && !partData.vipDraw && !partData.draw.prizes?.is_vip;

                if (!hasPendingVipSpin) {
                  setResult({
                    success: true,
                    alreadyDrawn: true,
                    draw: { id: partData.draw.id, source: partData.draw.source, drawnAt: partData.draw.drawn_at },
                    participation: { id: partData.id, status: partData.status },
                    participant: { id: partData.participant.id, name: displayName },
                    prize: {
                      id: partData.draw.prizes.id,
                      name: cleanPrizeName(partData.draw.prizes.name),
                      description: partData.draw.prizes.description,
                      imageUrl: partData.draw.prizes.image_url,
                    },
                    vipPrize: partData.vipDraw ? {
                      id: partData.vipDraw.prizes.id,
                      name: cleanPrizeName(partData.vipDraw.prizes.name),
                      description: partData.vipDraw.prizes.description,
                      imageUrl: partData.vipDraw.prizes.image_url,
                    } : undefined,
                  });
                  setParticipantName(displayName);
                  setPhase("RESULT");
                  return;
                }

                // Participante já girou o normal, mas agendou reunião e liberou o giro VIP!
                setParticipationId(partData.id);
                setParticipantName(displayName);
                setParticipantInfo("🌟 Já realizou o giro normal · ROLETA VIP LIBERADA!");
                setSelected({
                  participationId: partData.id,
                  participantId: partData.participant.id,
                  vip: true,
                  pendingVipOnly: true,
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
                setNormalWonPrize({
                  id: partData.draw.prizes.id,
                  name: cleanPrizeName(partData.draw.prizes.name),
                  description: partData.draw.prizes.description,
                  imageUrl: partData.draw.prizes.image_url,
                });
                setVipSpinStage("WAITING_VIP");
                setIsParticipantConfirmed(true);
                setPhase("READY");
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
          if (isVipSpin && vipSpinStage === "WAITING_VIP") {
            handleSpinVip();
          } else if (!isVipSpin || vipSpinStage === "READY_NORMAL") {
            handleSpinNormal();
          }
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

  async function handleSpinNormal() {
    if (phase === "DRAWING" || normalPrizes.length === 0) return;

    setPhase("DRAWING");
    if (isVipSpin) {
      setVipSpinStage("SPINNING_NORMAL");
    }
    setError(null);
    setSuspenseStatus("");
    triggerHaptic();

    try {
      let drawResponseData: DrawResponse;

      if (isDemoSpin || !participationId) {
        const demoNormal = normalPrizes[Math.floor(Math.random() * normalPrizes.length)] || {
          id: 1,
          name: "Caderno",
          description: null,
          image_url: null,
          available_stock: 100,
          probability: 20,
          active: true,
        };
        const demoVip = isVipSpin
          ? vipPrizes[Math.floor(Math.random() * vipPrizes.length)] || {
              id: 2,
              name: "Certificado",
              description: null,
              image_url: null,
              available_stock: 50,
              probability: 20,
              active: true,
            }
          : null;

        drawResponseData = {
          success: true,
          vip: isVipSpin,
          isDualDraw: isVipSpin,
          draw: { id: 9999, source: "AUTOMATIC", drawnAt: new Date().toISOString() },
          vipDraw: isVipSpin ? { id: 9998, source: "AUTOMATIC", drawnAt: new Date().toISOString() } : null,
          participation: { id: 9999, status: "APPROVED" },
          participant: { id: 9999, name: participantName || (isVipSpin ? "Visitante VIP" : "Visitante Finora") },
          prize: {
            id: demoNormal.id,
            name: demoNormal.name,
            description: demoNormal.description,
            imageUrl: demoNormal.image_url,
          },
          vipPrize: demoVip
            ? {
                id: demoVip.id,
                name: demoVip.name,
                description: demoVip.description,
                imageUrl: demoVip.image_url,
              }
            : null,
        };
      } else {
        const res = await fetch(`${getApiBaseUrl()}/draws/participation/${participationId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro ao realizar sorteio.");
        drawResponseData = data;
      }

      if (drawResponseData?.prize) {
        drawResponseData.prize.name = cleanPrizeName(drawResponseData.prize.name);
      }
      if (drawResponseData?.vipPrize) {
        drawResponseData.vipPrize.name = cleanPrizeName(drawResponseData.vipPrize.name);
      }

      setStoredDrawResponse(drawResponseData);

      // 1. Rotação da Roleta 1 (Normal / Brindes)
      const normalTargetId = drawResponseData.prize.id;
      const normalPrizeIndex = Math.max(0, normalPrizes.findIndex((p) => p.id === normalTargetId));
      const normalSliceDeg = 360 / Math.max(normalPrizes.length, 1);
      const normalTargetDeg = (360 - normalPrizeIndex * normalSliceDeg) % 360;
      const normalCurrent = ((rotationNormalRef.current % 360) + 360) % 360;
      const finalNormalRotation = rotationNormalRef.current + 8 * 360 + ((normalTargetDeg - normalCurrent + 360) % 360);

      rotationNormalRef.current = finalNormalRotation;
      setRotationNormal(finalNormalRotation);
      rotationRef.current = finalNormalRotation;
      setRotation(finalNormalRotation);

      if (stopTickerRef.current) {
        stopTickerRef.current();
      }
      stopTickerRef.current = startPhysicsTicker(SPIN_MS, soundEnabled, () => {
        setTickerCount((c) => c + 1);
      });

      // Aguarda o giro físico da Roleta 1 (5 segundos)
      setTimeout(() => {
        if (stopTickerRef.current) {
          stopTickerRef.current();
          stopTickerRef.current = null;
        }

        if (soundEnabled) {
          playSlowdownSound();
        }

        // Se for VIP: para a Roleta 1, salva o brinde e destrava o botão "Rolar Roleta VIP"
        if (isVipSpin) {
          setNormalWonPrize(drawResponseData.prize);
          setVipSpinStage("WAITING_VIP");
          setPhase("READY");
          triggerHaptic();
          return;
        }

        // Se NÃO for VIP (visitante comum): suspense dramático com delay antes de exibir os parabéns
        setSuspenseStatus("🌟 CONFERINDO RESULTADO...");
        setTimeout(() => {
          if (soundEnabled) {
            playWinFanfare();
            speakWinner(drawResponseData.participant.name, drawResponseData.prize.name);
          }

          const rarity = getPrizeRarity(drawResponseData.prize.name);
          const victoryColor = rarity === "COMMON" ? "#0077FF" : RARITY[rarity].color;
          fireVictoryCelebration(eventAccent(), victoryColor);

          setResult(drawResponseData);
          setPhase("RESULT");
          setSuspenseStatus("");
        }, 2500);
      }, SPIN_MS);
    } catch (err) {
      if (stopTickerRef.current) {
        stopTickerRef.current();
        stopTickerRef.current = null;
      }
      setError(err instanceof Error ? err.message : "Erro ao processar giro.");
      setPhase("READY");
      if (isVipSpin) setVipSpinStage("READY_NORMAL");
    }
  }

  async function handleSpinVip() {
    if (phase === "DRAWING" || vipPrizes.length === 0) return;

    setPhase("DRAWING");
    setVipSpinStage("SPINNING_VIP");
    setError(null);
    setSuspenseStatus("");
    triggerHaptic();

    try {
      let vipDrawResponse = storedDrawResponse;
      if (!vipDrawResponse?.vipPrize) {
        if (isDemoSpin || !participationId) {
          const non50Vip = vipPrizes.filter((p) => !p.name.includes("50%"));
          const poolDemo = non50Vip.length > 0 ? non50Vip : vipPrizes;
          const demoVip = poolDemo[Math.floor(Math.random() * poolDemo.length)] || vipPrizes[0];
          vipDrawResponse = {
            success: true,
            vip: true,
            isDualDraw: true,
            draw: { id: 9999, source: "AUTOMATIC", drawnAt: new Date().toISOString() },
            vipDraw: { id: 9998, source: "AUTOMATIC", drawnAt: new Date().toISOString() },
            participation: { id: 9999, status: "APPROVED" },
            participant: { id: 9999, name: participantName || "Visitante VIP" },
            prize: normalWonPrize || {
              id: 1,
              name: "Brinde",
              description: null,
              imageUrl: null,
            },
            vipPrize: {
              id: demoVip.id,
              name: demoVip.name,
              description: demoVip.description,
              imageUrl: demoVip.image_url,
            },
          };
        } else {
          const res = await fetch(`${getApiBaseUrl()}/draws/participation/${participationId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Erro ao realizar sorteio VIP.");
          vipDrawResponse = data;
        }
        if (vipDrawResponse?.prize) {
          vipDrawResponse.prize.name = cleanPrizeName(vipDrawResponse.prize.name);
        }
        if (vipDrawResponse?.vipPrize) {
          vipDrawResponse.vipPrize.name = cleanPrizeName(vipDrawResponse.vipPrize.name);
        }
        setStoredDrawResponse(vipDrawResponse);
        if (vipDrawResponse?.prize && !normalWonPrize) {
          setNormalWonPrize(vipDrawResponse.prize);
        }
      }

      if (!vipDrawResponse || !vipDrawResponse.vipPrize) {
        throw new Error("Não foi possível sortear o prêmio VIP.");
      }

      const currentFinalDraw = vipDrawResponse;
      const targetVipPrize = vipDrawResponse.vipPrize;
      const vipTargetId = targetVipPrize.id;
      const vipPrizeIndex = Math.max(0, vipPrizes.findIndex((p) => p.id === vipTargetId));
      const vipSliceDeg = 360 / Math.max(vipPrizes.length, 1);
      const vipTargetDeg = (360 - vipPrizeIndex * vipSliceDeg) % 360;
      const vipCurrent = ((rotationVipRef.current % 360) + 360) % 360;
      // 9 giros para criar um timing diferenciado e empolgante
      const finalVipRotation = rotationVipRef.current + 9 * 360 + ((vipTargetDeg - vipCurrent + 360) % 360);

      rotationVipRef.current = finalVipRotation;
      setRotationVip(finalVipRotation);

      if (stopTickerRef.current) {
        stopTickerRef.current();
      }
      stopTickerRef.current = startPhysicsTicker(SPIN_MS, soundEnabled, () => {
        setTickerCount((c) => c + 1);
      });

      // Aguarda o giro físico da Roleta VIP (5 segundos)
      setTimeout(() => {
        if (stopTickerRef.current) {
          stopTickerRef.current();
          stopTickerRef.current = null;
        }

        if (soundEnabled) {
          playSlowdownSound();
        }

        // Suspense maior e dramático antes de aparecer a tela de parabéns
        setVipSpinStage("SUSPENSE");
        setSuspenseStatus("👑 CONFERINDO SUA PREMIAÇÃO VIP EXCLUSIVA...");
        triggerHaptic();

        // Delay de suspense dramático de 3.2 segundos
        setTimeout(() => {
          if (soundEnabled) {
            playWinFanfare();
            if (currentFinalDraw.vipPrize) {
              speakWinner(currentFinalDraw.participant.name, `${currentFinalDraw.prize?.name || "Brinde"} e ${currentFinalDraw.vipPrize.name}`);
            }
          }

          fireVictoryCelebration(eventAccent(), "#FFD700");
          setResult(currentFinalDraw);
          setPhase("RESULT");
          setSuspenseStatus("");
        }, 3200);
      }, SPIN_MS);
    } catch (err) {
      if (stopTickerRef.current) {
        stopTickerRef.current();
        stopTickerRef.current = null;
      }
      setError(err instanceof Error ? err.message : "Erro ao girar roleta VIP.");
      setPhase("READY");
      setVipSpinStage("WAITING_VIP");
    }
  }

  // Alias para manter compatibilidade caso seja invocado por clique na roda
  function handleSpin() {
    if (isVipSpin) {
      if (vipSpinStage === "WAITING_VIP") {
        handleSpinVip();
      } else if (vipSpinStage === "READY_NORMAL") {
        handleSpinNormal();
      }
    } else {
      handleSpinNormal();
    }
  }

  const filteredPending = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
    const qDigits = q.replace(/\D/g, "");
    let list = pendingList;
    if (q) {
      list = pendingList.filter(
        (p: any) =>
          p.fullName.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          (p.cpf && p.cpf.includes(qDigits && qDigits.length > 0 ? qDigits : q)) ||
          (p.cpfFormatted && p.cpfFormatted.toLowerCase().includes(q)) ||
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
    const isDual = Boolean(result.vipPrize);
    const rarity = getPrizeRarity(result.prize.name);
    const image = result.prize.imageUrl || result.prize.image_url;
    const vipImage = result.vipPrize?.imageUrl || result.vipPrize?.image_url;

    return (
      <div className="relative h-dvh max-h-dvh w-full overflow-hidden flex flex-col justify-between items-center px-4 py-3 sm:py-5 select-none text-center">
        {/* Fundo com grade cibernética e aura de vitória leve */}
        <div className="cyber-grid-overlay pointer-events-none" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none opacity-40"
          style={{
            background: isDual
              ? "radial-gradient(circle, #FFD700 0%, var(--event-accent, #22C3DC) 50%, transparent 70%)"
              : "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 70%)",
          }}
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

        {/* Centro: Prêmio e Cards Holográficos */}
        <div className="flex-1 min-h-0 w-full max-w-3xl flex flex-col items-center justify-center gap-3 sm:gap-4 z-10 my-auto py-1">
          <div className="animate-pop-burst flex flex-col items-center gap-1.5 sm:gap-2">
            {isDual ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/30 to-[#996515]/30 px-4 py-1.5 font-mono text-xs sm:text-sm font-black text-[#FFDF73] shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                <Crown size={15} className="text-[#FFDF73]" /> PRÊMIO DUPLO VIP LIBERADO
              </span>
            ) : (
              <RarityBadge rarity={rarity} prefix="Prêmio " className="text-sm sm:text-base shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
            )}
            <h1 className="font-display text-[clamp(26px,4.2vw,48px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
              {isDual ? (
                <>
                  Você ganhou 2 Prêmios!
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFE57F] via-white to-[#FFD54F]">
                    Brinde + Benefício VIP
                  </span>
                </>
              ) : (
                <>
                  Você ganhou
                  <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-accent to-white">
                    {result.prize.name}
                  </span>
                </>
              )}
            </h1>
          </div>

          {/* Cards de Premiação: se dual, exibe os 2 lado a lado */}
          <div className={`w-full grid gap-3 sm:gap-4 ${isDual ? "grid-cols-1 md:grid-cols-2" : "max-w-[540px]"}`}>
            {/* Card do Brinde Normal */}
            <div className="holographic-card flex flex-col sm:grid sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-accent/40 bg-ink-800/95 backdrop-blur-xl text-left shadow-[0_16px_50px_rgba(0,0,0,0.6),0_0_25px_rgba(var(--accent-rgb),0.2)]">
              <div className="flex items-center justify-center bg-ink-700/80 p-3 border-b sm:border-b-0 sm:border-r border-ink-line min-h-[90px] sm:min-h-0">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="max-h-24 sm:max-h-28 w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-float-slow" />
                ) : (
                  <span className="text-xs sm:text-sm font-semibold text-accent text-center px-2">{result.prize.description || "Brinde Finora"}</span>
                )}
              </div>
              <div className="flex flex-col justify-center gap-1.5 p-3.5 sm:p-4">
                <span className="text-[10px] sm:text-[11px] font-bold text-accent uppercase tracking-wider">🎁 ROLETA 1 · BRINDE BALCÃO</span>
                <span className="text-base sm:text-lg font-black text-white">{result.prize.name}</span>
                <span className="text-xs text-ink-text-2">{result.prize.description || "Disponível para retirada imediata."}</span>
              </div>
            </div>

            {/* Card do Prêmio VIP (se houver) */}
            {isDual && result.vipPrize && (
              <div className="holographic-card flex flex-col sm:grid sm:grid-cols-[minmax(0,140px)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[#FFD700]/70 bg-gradient-to-br from-[#2B1B04]/95 via-ink-800/95 to-ink-900/95 backdrop-blur-xl text-left shadow-[0_16px_50px_rgba(0,0,0,0.6),0_0_30px_rgba(255,215,0,0.35)]">
                <div className="flex items-center justify-center bg-[#3E2723]/60 p-3 border-b sm:border-b-0 sm:border-r border-[#FFD700]/30 min-h-[90px] sm:min-h-0">
                  {vipImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vipImage} alt="" className="max-h-24 sm:max-h-28 w-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-float-slow" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Crown size={28} className="text-[#FFDF73] animate-pulse" />
                      <span className="text-[11px] font-bold text-[#FFDF73] text-center">VIP MENTORADO</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-1.5 p-3.5 sm:p-4">
                  <span className="text-[10px] sm:text-[11px] font-black text-[#FFDF73] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} className="text-[#FFDF73]" /> ROLETA 2 · PRÊMIO VIP 🌟
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#FFE082]">{result.vipPrize.name}</span>
                  <span className="text-xs text-slate-300">{result.vipPrize.description || "Benefício especial liberado para ativação."}</span>
                </div>
              </div>
            )}
          </div>

          {/* Informações para retirada do prêmio */}
          <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-line bg-ink-900/80 px-6 py-2.5 backdrop-blur shadow-md">
            <span className="text-[11px] sm:text-xs font-bold text-accent uppercase tracking-wider">Retirada no Balcão de Prêmios</span>
            <span className="text-sm sm:text-base font-semibold text-white">
              Informe seu <span className="text-accent font-bold">Nome</span> ou <span className="text-accent font-bold">CPF</span> no balcão
            </span>
            <span className="flex items-center gap-1.5 text-xs text-ink-text mt-0.5">
              <Check size={14} className="text-[#4ADE80]" />
              <span>{isDual ? "Retire seu brinde e ative seu benefício VIP com a equipe!" : "Cupom do Sorteio Geral garantido!"}</span>
            </span>
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
    const isSpinningNormal = phase === "DRAWING" && (!isVipSpin || vipSpinStage === "SPINNING_NORMAL");
    const isSpinningVip = phase === "DRAWING" && vipSpinStage === "SPINNING_VIP";
    const isWaitingVip = isVipSpin && vipSpinStage === "WAITING_VIP";
    const isSuspense = vipSpinStage === "SUSPENSE";

    const siteOrigin =
      typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://grupoqmax.com.br";
    const eventSlug = event?.route || "invictus";
    const scheduleUrl = selected?.participantId
      ? `${siteOrigin}/finora-experience/${eventSlug}/agendamento/${selected.participantId}?event=${activeEventId}`
      : `${siteOrigin}/finora-experience/${eventSlug}/agendamento?event=${activeEventId}`;

    return (
      <div className="relative h-dvh max-h-dvh w-full overflow-hidden flex flex-col justify-between items-center px-3 sm:px-6 py-2 select-none">
        {/* Efeito de ambiente futurista e dourado */}
        <div className="cyber-grid-overlay pointer-events-none opacity-40" />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none opacity-25"
          style={{
            background: isVipSpin
              ? "radial-gradient(circle, #FFD700 0%, var(--event-accent, #22C3DC) 50%, transparent 75%)"
              : "radial-gradient(circle, var(--event-accent, #22C3DC) 0%, transparent 75%)",
          }}
        />

        {/* Barra superior */}
        <div className="flex-none w-full max-w-6xl h-10 sm:h-11 flex items-center justify-between z-20 px-1">
          <div className="flex items-center gap-3">
            <FinoraLogo className="text-[19px] sm:text-[23px]" />
            <span className="font-mono text-xs tracking-[0.08em] text-accent uppercase hidden sm:inline">{event?.label}</span>
          </div>

          {/* Badge superior */}
          {isVipSpin ? (
            <div className="flex items-center gap-2 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/30 to-[#996515]/30 px-3.5 py-1 shadow-[0_0_20px_rgba(212,175,55,0.4)] backdrop-blur">
              <Crown size={14} className="text-[#FFDF73] animate-bounce" />
              <span className="font-mono text-xs font-black text-[#FFDF73] uppercase tracking-wider">
                DUPLA ROLETA VIP
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] sm:max-w-[200px]">
                {spinning ? "Boa sorte!" : isDemoSpin ? "Modo Teste VIP" : firstName}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-ink-800/90 px-3.5 py-1 shadow-md backdrop-blur">
              <Sparkles size={14} className="text-accent animate-pulse" />
              <span className="font-mono text-xs font-black text-accent uppercase tracking-wider">
                EXPERIÊNCIA FINORA
              </span>
              <span className="h-3 w-px bg-white/20" />
              <span className="text-xs sm:text-sm font-bold text-white truncate max-w-[130px] sm:max-w-[200px]">
                {spinning ? "Boa sorte!" : isDemoSpin ? "Modo Teste" : firstName}
              </span>
            </div>
          )}

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

        {/* ÁREA DAS DUAS ROLETAS LADO A LADO */}
        <div className="flex-1 min-h-0 w-full max-w-6xl flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 my-auto z-10 px-2 py-1">
          {/* Roleta 1: Brindes (Liberada para todos) */}
          <div className={`flex flex-col items-center justify-center flex-1 w-full max-w-[min(85vw,calc(45dvh-40px),420px)] md:max-w-[460px] transition-all duration-500 ${isWaitingVip || isSpinningVip || isSuspense ? "opacity-85 scale-95" : "opacity-100 scale-100"}`}>
            <div className="flex items-center gap-2 mb-2 px-3 py-1 rounded-full border border-accent/40 bg-ink-800/80 backdrop-blur shadow-sm">
              <span className="font-mono text-[11px] sm:text-xs font-black tracking-wider text-accent uppercase">
                {normalWonPrize ? `✔ BRINDE GANHO: ${normalWonPrize.name}` : "ROLETA 1 · BRINDES"}
              </span>
            </div>
            <div className="relative flex items-center justify-center w-full aspect-square">
              <Wheel
                names={normalPrizes.map((p) => p.name)}
                rotation={rotationNormal}
                spinning={isSpinningNormal}
                durationMs={SPIN_MS}
                tickerCount={tickerCount}
                onSpin={!isWaitingVip && !spinning ? handleSpinNormal : undefined}
                variant="normal"
              />
            </div>
          </div>

          {/* Divisor Central Estilizado */}
          <div className="hidden md:flex flex-col items-center justify-center gap-2 flex-none px-2 text-center">
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-[#FFD700] to-transparent" />
            <span className="font-display text-2xl font-black text-[#FFDF73] drop-shadow-[0_0_12px_rgba(255,215,0,0.6)]">+</span>
            <div className="h-16 w-px bg-gradient-to-b from-transparent via-[#FFD700] to-transparent" />
          </div>

          {/* Roleta 2: Prêmios VIP Dourados (Liberada se VIP, ou bloqueada com QR Code de agendamento) */}
          <div className={`flex flex-col items-center justify-center flex-1 w-full max-w-[min(85vw,calc(45dvh-40px),420px)] md:max-w-[460px] transition-all duration-500 ${isWaitingVip ? "scale-105 drop-shadow-[0_0_35px_rgba(255,215,0,0.5)]" : isSpinningVip || isSuspense ? "scale-105" : isVipSpin ? "opacity-75" : "opacity-95"}`}>
            <div className={`flex items-center gap-2 mb-2 px-3 py-1 rounded-full border ${isVipSpin ? "border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/30 to-[#996515]/30 shadow-[0_0_15px_rgba(212,175,55,0.4)]" : "border-[#FFD700]/50 bg-black/70 shadow-md"} ${isWaitingVip ? "animate-bounce" : ""}`}>
              {isVipSpin ? <Crown size={13} className="text-[#FFDF73]" /> : <Lock size={13} className="text-[#FFD700]" />}
              <span className="font-mono text-[11px] sm:text-xs font-black tracking-wider text-[#FFDF73] uppercase">
                {isVipSpin ? "ROLETA 2 · PRÊMIOS VIP 👑" : "ROLETA 2 · BLOQUEADA"}
              </span>
            </div>

            <div className="relative flex items-center justify-center w-full aspect-square">
              {/* Roleta VIP em si (visível mas com blur se não-VIP) */}
              <div className={`w-full h-full flex items-center justify-center ${!isVipSpin ? "opacity-35 blur-[2.5px] pointer-events-none select-none transition-all duration-500" : ""}`}>
                <Wheel
                  names={vipPrizes.map((p) => p.name)}
                  rotation={rotationVip}
                  spinning={isSpinningVip}
                  durationMs={SPIN_MS}
                  tickerCount={tickerCount}
                  onSpin={isWaitingVip ? handleSpinVip : undefined}
                  variant="vip"
                />
              </div>

              {/* CARD SOBREPOSTO COM QR CODE PARA LIBERAR A ROLETA (SE NÃO FOR VIP) */}
              {!isVipSpin && (
                <div className="absolute inset-2 sm:inset-4 rounded-3xl border-2 border-[#FFD700] bg-gradient-to-b from-[#090E1C]/95 via-[#0C1222]/95 to-[#080D1A]/95 backdrop-blur-md p-4 sm:p-5 flex flex-col items-center justify-center gap-2.5 shadow-[0_0_40px_rgba(255,215,0,0.35)] text-center animate-pop-burst z-20">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-[#FFD700] bg-[#FFD700]/20 px-3 py-1 shadow-[0_0_15px_rgba(255,215,0,0.3)]">
                    <Lock size={14} className="text-[#FFE57F]" />
                    <span className="font-mono text-[11px] sm:text-xs font-black tracking-wider text-[#FFE57F] uppercase">
                      LIBERAR ROLETA VIP
                    </span>
                  </div>

                  {/* QR Code de Alta Definição */}
                  <div className="rounded-2xl bg-white p-2.5 shadow-[0_0_25px_rgba(255,215,0,0.4)] border-2 border-[#FFD700]">
                    <QRCodeSVG
                      value={scheduleUrl}
                      size={116}
                      level="M"
                      includeMargin={false}
                      fgColor="#080D1A"
                    />
                  </div>

                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-display text-xs sm:text-[13px] font-black text-white uppercase tracking-wide">
                      Escaneie para Liberar a Roleta 2
                    </span>
                    <p className="text-[10.5px] sm:text-[11.5px] text-[#C2CEE3] max-w-[230px] leading-tight">
                      Agende um bate-papo de 30 min com nosso CEO Hugo Werninghaus e concorra a consultorias, mentorias e honorários grátis!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Botão de Ação Inferior */}
        <div className="flex-none w-full max-w-md flex flex-col items-center gap-2 pb-1 sm:pb-2 z-20">
          {isWaitingVip ? (
            <>
              <div className="flex flex-col items-center gap-0.5 text-center animate-pop-burst">
                <span className="text-xs sm:text-[13px] font-mono font-bold text-accent">
                  🎉 Brinde Conquistado: <strong className="text-white underline">{normalWonPrize?.name}</strong>!
                </span>
                <span className="text-[11px] sm:text-xs text-[#FFDF73] font-bold uppercase tracking-wider">
                  Agora libere o seu giro no Pool de Prêmios VIP:
                </span>
              </div>
              <button
                type="button"
                onClick={handleSpinVip}
                className="w-full h-15 sm:h-18 rounded-full text-xl sm:text-2xl font-black active:scale-[0.98] transition-all cursor-pointer shadow-[0_12px_45px_rgba(255,215,0,0.7)] flex items-center justify-center gap-3 bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] hover:brightness-110 animate-pulse-glow"
              >
                <Crown size={26} className="text-[#3E2723] animate-bounce" />
                <span>ROLAR ROLETA VIP 🌟</span>
                <ArrowRight size={24} className="animate-pulse text-[#3E2723]" />
              </button>
            </>
          ) : isSpinningVip || isSuspense ? (
            <div className="w-full h-15 sm:h-18 rounded-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#FFE57F]/30 via-[#FFD700]/30 to-[#FF9900]/30 border-2 border-[#FFD700] text-[#FFDF73] font-display text-lg sm:text-xl font-black shadow-[0_0_30px_rgba(255,215,0,0.4)] animate-pulse">
              <LoaderCircle size={24} className="animate-spin text-[#FFDF73]" />
              <span>{isSuspense ? "👑 APURANDO PREMIAÇÃO VIP EXCLUSIVA..." : "Girando a Roleta VIP…"}</span>
            </div>
          ) : isSpinningNormal ? (
            <div className="w-full h-15 sm:h-18 rounded-full flex items-center justify-center gap-3 bg-accent/20 border-2 border-accent text-accent font-display text-lg sm:text-xl font-black shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] animate-pulse">
              <LoaderCircle size={24} className="animate-spin text-accent" />
              <span>Girando Roleta 1 (Brindes)…</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleSpinNormal}
                disabled={spinning}
                className="w-full h-15 sm:h-18 rounded-full text-xl sm:text-2xl font-black active:scale-[0.98] transition-all cursor-pointer shadow-[0_12px_45px_rgba(34,195,220,0.4)] flex items-center justify-center gap-3 bg-accent text-ink-950 hover:brightness-110 animate-pulse-glow"
              >
                <span>GIRAR ROLETA 1 (BRINDES) 🎯</span>
                <ArrowRight size={24} className="animate-pulse text-ink-950" />
              </button>
              {!isVipSpin && (
                <span className="text-[11px] sm:text-xs text-[#FFDF73] font-bold text-center">
                  💡 Quer girar também a Roleta VIP? Escaneie o QR Code na Roleta 2 acima para destravar!
                </span>
              )}
            </>
          )}

          <div className="flex items-center gap-1.5 text-xs font-mono text-ink-text-2">
            <kbd className="px-2 py-0.5 rounded bg-ink-800 border border-ink-line text-[11px] font-bold text-[#FFD700]">[Espaço]</kbd>
            <span>{isWaitingVip ? "para rolar a Roleta VIP!" : "ou clique na roleta para girar"}</span>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-[#FF8FA3]">
              <CircleAlert size={14} /> {error}
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
              Digite o nome ou CPF para localizar o participante.
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
                placeholder="Nome, CPF ou clínica…"
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
                  onClick={() => startDemoMode(false)}
                  className="text-xs font-mono font-bold text-accent hover:underline flex items-center gap-1 cursor-pointer ml-1"
                >
                  <Play size={12} fill="currentColor" /> Teste Normal
                </button>
                <button
                  type="button"
                  onClick={() => startDemoMode(true)}
                  className="text-xs font-mono font-bold text-[#FFD700] hover:underline flex items-center gap-1 cursor-pointer ml-1"
                >
                  <Crown size={12} className="text-[#FFD700]" /> Teste 2 Roletas VIP
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
              <ul className="max-h-[55dvh] overflow-y-auto divide-y divide-ink-line/40 rounded-xl border border-ink-line/60 bg-ink-900/40">
                {filteredPending.map((p, idx) => {
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
                            <span className="mr-2 rounded-full bg-accent px-2 py-0.5 font-mono text-xs font-bold text-ink-950">
                              {p.pendingVipOnly ? "VIP · GIRO 2" : "VIP"}
                            </span>
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
                    <Crown size={14} className="text-[#FFDF73]" /> DUPLA ROLETA VIP 🌟
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="font-display text-[32px] sm:text-[36px] font-black leading-tight tracking-tight text-white">{participantName}</span>
                {participantInfo && <span className="text-[16px] text-ink-text-2 font-medium">{participantInfo}</span>}
              </div>

              <ul className="flex flex-col gap-2.5 rounded-xl bg-ink-900/60 p-4 border border-ink-line">
                {[
                  "Cadastro validado no sistema",
                  isVipSpin
                    ? "Giro Duplo VIP: Roleta 1 (Brindes) + Roleta 2 (Prêmios VIP)"
                    : "1 giro oficial de brindes no balcão",
                ].map((t) => (
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
                  className={`flex h-17 items-center justify-center gap-2.5 rounded-full px-6 text-xl font-black active:scale-[0.98] transition-all cursor-pointer ${
                    isVipSpin
                      ? "bg-gradient-to-r from-[#FFE57F] via-[#FFD54F] to-[#FFC107] text-[#3E2723] shadow-[0_8px_30px_rgba(255,213,79,0.5)] hover:brightness-110 animate-pulse-glow"
                      : "bg-accent text-ink-950 shadow-[0_8px_30px_rgba(var(--accent-rgb),0.4)] hover:brightness-105"
                  }`}
                >
                  <span>{isVipSpin ? `Liberar 2 Roletas para ${firstName} 🌟` : `Liberar Roleta para ${firstName}`}</span>
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

              <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => startDemoMode(false)}
                  className="flex h-12 sm:h-13 items-center gap-2 rounded-full bg-accent px-6 text-sm sm:text-base font-bold text-ink-950 shadow-[0_0_20px_rgba(var(--accent-rgb),0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Testar Roleta Normal</span>
                </button>
                <button
                  type="button"
                  onClick={() => startDemoMode(true)}
                  className="flex h-12 sm:h-13 items-center gap-2 rounded-full bg-gradient-to-r from-[#FFE57F] via-[#FFD54F] to-[#FFC107] px-6 text-sm sm:text-base font-bold text-[#3E2723] shadow-[0_0_20px_rgba(255,213,79,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Crown size={16} className="text-[#3E2723]" />
                  <span>Testar 2 Roletas VIP 🌟</span>
                </button>
              </div>
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
