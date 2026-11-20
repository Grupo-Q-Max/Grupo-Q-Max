"use client";

import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { pinFromQr } from "@/lib/pin";
import { CLAIM_QUEUE, enqueue, flushQueue, isNetworkError, OFFLINE_QUEUE_EVENT, readQueue } from "@/lib/offline-queue";

// Retiradas pendentes baixadas enquanto online, para conferir PIN sem internet.
const CLAIMS_CACHE = "finora-pending-claims";

function readClaimsCache(): ClaimData[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CLAIMS_CACHE) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeClaimsCache(items: ClaimData[]) {
  try {
    window.localStorage.setItem(CLAIMS_CACHE, JSON.stringify(items));
  } catch {}
}
import {
  PackageCheck,
  Gift,
  Search,
  CheckCircle2,
  AlertTriangle,
  LoaderCircle,
  Sparkles,
  RotateCcw,
  UserRound,
  Camera,
  X,
  ClipboardCheck,
  Printer,
  Wifi,
  CalendarDays
} from "lucide-react";

import { getAdminProxyUrl } from "@/lib/api-client";
import { playWinFanfare, playBeepSound, playApplauseSound } from "@/lib/audio";

import { useToast } from "@/components/ui/Toast";

type ClaimData = {
  participationId: number;
  eventId: number;
  eventName?: string;
  participantId: number;
  pin: string;
  participantName: string;
  cpfLastDigits: string;
  clinicName: string;
  cro: string | null;
  city: string | null;
  state: string | null;
  prizeName: string;
  prizeDescription: string | null;
  status: string;
  isDelivered: boolean;
  completedAt: string | null;
  drawnAt: string;
  hasMeeting: boolean;
  offline?: boolean;
};

export default function QuickClaimControl() {
  const toast = useToast();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimData, setClaimData] = useState<ClaimData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [shiftStart] = useState<string>(
    new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  );
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pingMs, setPingMs] = useState<number>(18);
  const [pendingClaims, setPendingClaims] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Monitor de Conexão / Latência (Offline Guard)
  useEffect(() => {
    async function checkPing() {
      const start = Date.now();
      try {
        const proxyUrl = getAdminProxyUrl();
        const res = await fetch(`${proxyUrl}/events`, { method: "HEAD", cache: "no-store" });
        if (res.ok) {
          setPingMs(Date.now() - start);
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch {
        setIsOnline(false);
      }
    }

    checkPing();
    const interval = setInterval(checkPing, 15000);
    return () => clearInterval(interval);
  }, []);

  // Modo offline: baixa as retiradas pendentes dos eventos ativos e envia as
  // entregas feitas sem internet quando a conexão volta.
  useEffect(() => {
    const proxyUrl = getAdminProxyUrl();
    const refreshCount = () => setPendingClaims(readQueue(CLAIM_QUEUE).length);

    async function syncClaims() {
      if (!navigator.onLine) return;
      setPendingClaims(await flushQueue(CLAIM_QUEUE));
      try {
        const events: { id: number; status: string }[] = await (await fetch(`${proxyUrl}/events`, { cache: "no-store" })).json();
        const lists = await Promise.all(
          events
            .filter((e) => e.status === "ACTIVE")
            .map((e) => fetch(`${proxyUrl}/draws/event/${e.id}/pending-claims`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : []))),
        );
        const queued = new Set(readQueue(CLAIM_QUEUE).map((q) => q.id));
        // Entregas offline ainda não enviadas continuam marcadas como entregues.
        writeClaimsCache(lists.flat().map((c: ClaimData) => (queued.has(`claim-${c.participationId}`) ? { ...c, isDelivered: true, status: "COMPLETED" } : c)));
      } catch {}
    }

    refreshCount();
    syncClaims();
    const interval = setInterval(syncClaims, 60_000);
    window.addEventListener("online", syncClaims);
    window.addEventListener(OFFLINE_QUEUE_EVENT, refreshCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", syncClaims);
      window.removeEventListener(OFFLINE_QUEUE_EVENT, refreshCount);
    };
  }, []);

  function handlePrintReceipt() {
    if (!claimData) return;
    const printWindow = window.open("", "_blank", "width=380,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comprovante de Brinde - Finora</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            body { font-family: monospace; font-size: 12px; color: #000; text-align: center; margin: 0; padding: 8px; }
            .logo { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .title { font-size: 13px; font-weight: bold; margin: 4px 0; }
            .info { text-align: left; font-size: 11px; line-height: 1.4; }
            .pin { font-size: 22px; font-weight: bold; margin: 6px 0; letter-spacing: 2px; }
            .qr { margin: 6px auto; display: block; }
            .footer { font-size: 10px; color: #333; margin-top: 6px; }
          </style>
        </head>
        <body>
          <div class="logo">FINORA EXPERIENCE</div>
          <div>${claimData.eventName ?? ""}</div>
          <div class="divider"></div>
          <div class="title">COMPROVANTE DE ENTREGA</div>
          <div class="pin">PIN #${claimData.pin}</div>
          <div class="divider"></div>
          <div class="info">
            <strong>Ganhador:</strong> ${claimData.participantName}<br/>
            <strong>Clínica:</strong> ${claimData.clinicName || "Não informada"}<br/>
            <strong>Brinde:</strong> ${claimData.prizeName}<br/>
            <strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}
          </div>
          <div class="divider"></div>
          <div class="qr">${document.getElementById("receipt-qr")?.outerHTML ?? ""}</div>
          <div class="footer">Obrigado por visitar o estande da Finora!</div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }


  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Atalhos de Teclado (Enter para confirmar, Escape para limpar)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isScanning) {
          stopScanner();
        } else {
          handleReset();
        }
      } else if (e.key === "Enter" && claimData && !claimData.isDelivered && !claiming && claimData.hasMeeting) {
        e.preventDefault();
        handleConfirmDelivery();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [claimData, claiming, isScanning]);

  async function handleSearch(pinToSearch: string) {
    const cleanPin = pinToSearch.replace(/\D/g, "");
    if (!cleanPin) return;

    setLoading(true);
    setError(null);
    setClaimData(null);

    try {
      const proxyUrl = getAdminProxyUrl();
      const participationId = parseInt(cleanPin, 10);
      let res: Response;
      try {
        res = await fetch(`${proxyUrl}/draws/participation/${participationId}/verify-claim`);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        const cached = readClaimsCache().find((c) => c.participationId === participationId);
        if (!cached) throw new Error("Sem internet e este PIN não está na lista baixada. Tente de novo quando a conexão voltar.");
        playBeepSound();
        setClaimData({ ...cached, offline: true });
        return;
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Código PIN não encontrado.");
      }

      playBeepSound();
      setClaimData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar PIN.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoBookVIP() {
    if (!claimData) return;
    try {
      const proxyUrl = getAdminProxyUrl();
      const slotsRes = await fetch(`${proxyUrl}/meetings/event/${claimData.eventId}/available-slots?date=${new Date().toISOString().split('T')[0]}`);
      const slots = await slotsRes.json();
      if (!slots || slots.length === 0) {
        toast.error("Nenhum horário disponível para hoje.", "Aviso");
        return;
      }
      const firstSlot = slots[0];
      const res = await fetch(`${proxyUrl}/meetings/event/${claimData.eventId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: claimData.participantId,
          scheduledAt: firstSlot
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erro ao agendar horário.");
      }
      toast.success("Consultoria VIP auto-agendada e notificada no WhatsApp do participante!", "Agendamento Concluído");
      setClaimData({ ...claimData, hasMeeting: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao auto-agendar.", "Falha");
    }
  }

  async function handleConfirmDelivery() {
    if (!claimData || claiming) return;

    setClaiming(true);
    try {
      const proxyUrl = getAdminProxyUrl();
      const claimUrl = `${proxyUrl}/draws/participation/${claimData.participationId}/claim`;
      let offline = false;
      try {
        const res = await fetch(claimUrl, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Erro ao registrar entrega.");
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        // Sem internet: guarda a entrega (claim é idempotente na API) e envia depois.
        offline = true;
        enqueue(CLAIM_QUEUE, { id: `claim-${claimData.participationId}`, url: claimUrl, body: {} });
        writeClaimsCache(readClaimsCache().map((c) => (c.participationId === claimData.participationId ? { ...c, isDelivered: true, status: "COMPLETED" } : c)));
      }

      playWinFanfare();
      playApplauseSound();
      setSessionCount((prev) => prev + 1);
      toast.success(
        offline ? `Entrega de ${claimData.participantName} salva no aparelho; enviamos quando a internet voltar.` : `Brinde entregue para ${claimData.participantName}!`,
        offline ? "Entrega offline" : "Entrega Confirmada",
      );



      setClaimData({
        ...claimData,
        isDelivered: true,
        status: "COMPLETED",
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao entregar brinde.", "Falha");
    } finally {
      setClaiming(false);
    }
  }

  function handleReset() {
    setPin("");
    setClaimData(null);
    setError(null);
    setFeedbackRating(null);
    inputRef.current?.focus();
  }


  // Iniciar Leitor de Câmera
  async function startScanner() {
    setIsScanning(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Câmera não suportada neste navegador.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      scanLoop();
    } catch (err) {
      setIsScanning(false);
      setError(err instanceof Error ? err.message : "Não foi possível acessar a câmera.");
    }
  }

  // Leitura do QR pela câmera com o BarcodeDetector nativo (Chrome/Android).
  async function scanLoop() {
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) {
      setError("Este navegador não lê QR pela câmera. Use o leitor ou digite o PIN.");
      return;
    }
    const detector = new Detector({ formats: ["qr_code"] });
    while (streamRef.current) {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        const codes = await detector.detect(video).catch(() => []);
        const found = codes.map((c) => pinFromQr(c.rawValue)).find(Boolean);
        if (found) {
          stopScanner();
          setPin(found);
          handleSearch(found);
          return;
        }
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  function stopScanner() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col items-center justify-center max-w-xl mx-auto w-full text-text font-sans">
      {/* QR do comprovante impresso (copiado para a janela de impressão). */}
      {claimData && <QRCodeSVG id="receipt-qr" value={claimData.pin} size={100} level="M" className="hidden" />}
      {/* Card de Busca do PIN */}
      <div className="w-full bg-surface border border-line p-6 md:p-8 rounded-3xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <PackageCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Balcão de Atendimento
                </span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    isOnline
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                      : "bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse"
                  }`}
                  title={isOnline ? `Conexão Estável (${pingMs}ms)` : "Sem Conexão"}
                >
                  <Wifi size={10} className={isOnline ? "text-emerald-400" : "text-rose-400"} />
                  <span>{isOnline ? `${pingMs}ms` : "Offline"}</span>
                </span>
                {pendingClaims > 0 && (
                  <span className="rounded-full border border-[#F5D58A] bg-[#FFF3DC] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8A5D00]" title="Entregas feitas sem internet aguardando envio">
                    {pendingClaims} a enviar
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-text">
                Validação Rápida de Brindes
              </h2>
            </div>

          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShiftModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface hover:bg-line-strong text-text border border-line-strong text-xs font-bold transition-all"
              title="Resumo do Turno Atual"
            >
              <ClipboardCheck size={16} className="text-emerald-400" />
              <span>Turno ({sessionCount})</span>
            </button>

            <button
              type="button"
              onClick={isScanning ? stopScanner : startScanner}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-cyan-500/15 hover:bg-[#D6E7FF] text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all"
              title="Escanear QR Code com a Câmera"
            >
              <Camera size={16} />
              <span>{isScanning ? "Fechar Câmera" : "Bipar Câmera"}</span>
            </button>
          </div>
        </div>

        {/* Modal de Troca de Turno / Fechamento de Caixa */}
        {showShiftModal && (
          <div className="mb-5 p-5 bg-paper border-2 border-cyan-500/30 rounded-2xl flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck size={18} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-text">Fechamento do Turno Atual</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="text-text-2 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 my-1 text-center">
              <div className="bg-surface p-3 rounded-xl border border-line">
                <span className="text-[10px] text-text-2 block uppercase">Início do Turno</span>
                <strong className="text-base font-mono text-finora-600">{shiftStart}</strong>
              </div>
              <div className="bg-surface p-3 rounded-xl border border-line">
                <span className="text-[10px] text-text-2 block uppercase">Entregas Realizadas</span>
                <strong className="text-base font-mono text-emerald-400">{sessionCount} brindes</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSessionCount(0);
                  setShowShiftModal(false);
                  toast.success("Contador do turno zerado para o próximo promotor!", "Turno Reiniciado");
                }}
                className="flex-1 py-2 px-3 rounded-full bg-surface hover:bg-line-strong text-xs font-bold text-rose-400 border border-line-strong transition-all"
              >
                Zerar Contador (Novo Promotor)
              </button>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="py-2 px-4 rounded-full bg-finora-600 hover:bg-finora-700 text-xs font-bold text-white transition-all"
              >
                Continuar
              </button>
            </div>
          </div>
        )}


        {/* Modal de Scanner de Câmera */}
        {isScanning && (
          <div className="relative mb-5 bg-paper border-2 border-cyan-500/30 rounded-2xl overflow-hidden p-2 flex flex-col items-center">
            <div className="absolute top-3 right-3 z-10">
              <button
                type="button"
                onClick={stopScanner}
                className="p-1.5 rounded-full bg-surface text-text hover:bg-line-strong transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <video
              ref={videoRef}
              className="w-full max-h-56 rounded-xl object-cover bg-text"
              autoPlay
              playsInline
              muted
            />

            <div className="w-full text-center py-2">
              <span className="text-[11px] font-mono text-finora-600 animate-pulse block">
                Aponte para o QR Code do visitante
              </span>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(pin);
          }}
          className="flex flex-col gap-3"
        >
          <label className="text-xs text-text-2 font-medium">
            Digite o ID ou CPF do participante ou bipe com o leitor:
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={pin}
                onChange={(e) => {
                  const val = e.target.value;
                  setPin(val);
                  const clean = val.replace(/\D/g, "");
                  if (clean.length >= 3) {
                    handleSearch(clean);
                  }
                }}
                placeholder="ID ou CPF…"
                className="w-full bg-surface border-2 border-line-strong focus:border-finora-600 rounded-2xl px-5 py-3.5 text-2xl font-mono font-bold tracking-widest text-center text-emerald-400 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !pin}
              className="px-5 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Search size={18} />}
              <span>Buscar</span>
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Card do Resultado do PIN */}
      {claimData && (
        <div className="w-full mt-6 bg-surface border border-line rounded-3xl p-6 md:p-8 backdrop-blur animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-finora-600" />
              <span className="text-xs text-text-2">Participante Encontrado</span>
            </div>
            <span className="font-mono text-xs text-text-2 bg-paper px-2.5 py-1 rounded-lg border border-line">
              PIN #{claimData.pin}
            </span>
          </div>

          <div className="my-5">
            <h3 className="text-2xl font-extrabold text-text">
              {claimData.participantName}
            </h3>
            <p className="text-xs text-text-2 mt-1">
              {claimData.clinicName} • {claimData.cro || "CRO não informado"} • {claimData.city || "—"}
            </p>
          </div>

          {/* Destaque do Prêmio */}
          <div className="bg-emerald-500/15 border-2 border-emerald-500/30 rounded-2xl p-5 mb-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Gift size={28} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Brinde a ser Entregue
              </span>
              <strong className="text-lg md:text-xl font-black text-text block mt-0.5">
                {claimData.prizeName}
              </strong>
              {claimData.prizeDescription && (
                <p className="text-xs text-text-2 mt-0.5">{claimData.prizeDescription}</p>
              )}
            </div>
          </div>

          {/* Ações de Entrega */}
          {claimData.isDelivered ? (
            <div className="flex flex-col gap-3">
              <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={20} />
                <span>Brinde entregue com sucesso!</span>
              </div>

              {/* Avaliação Rápida CSAT (1 Toque) */}
              <div className="bg-paper border border-line p-4 rounded-2xl text-center">
                <span className="text-[11px] font-bold text-text-2 uppercase tracking-wider block mb-2">
                  Como foi a experiência do visitante no stand?
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackRating("INCREDIBLE");
                      playBeepSound();
                      toast.success("Avaliação 'Incrível' registrada!", "CSAT 100%");
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      feedbackRating === "INCREDIBLE"
                        ? "bg-[#FFF3DC] border-[#F2D19B] text-[#8A4B00]"
                        : "bg-surface border-line text-text hover:border-line-strong"
                    }`}
                  >
                    <span className="text-xl">😍</span>
                    <span>Incrível!</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackRating("GREAT");
                      playBeepSound();
                      toast.success("Avaliação 'Muito Bom' registrada!", "CSAT 100%");
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      feedbackRating === "GREAT"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : "bg-surface border-line text-text hover:border-line-strong"
                    }`}
                  >
                    <span className="text-xl">😄</span>
                    <span>Muito Bom!</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackRating("GOOD");
                      playBeepSound();
                      toast.success("Avaliação 'Legal' registrada!", "CSAT 100%");
                    }}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                      feedbackRating === "GOOD"
                        ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-400"
                        : "bg-surface border-line text-text hover:border-line-strong"
                    }`}
                  >
                    <span className="text-xl">👍</span>
                    <span>Legal!</span>
                  </button>
                </div>
              </div>

              <p className="text-center text-[11px] text-text-2">
                Entregue em: {claimData.completedAt ? new Date(claimData.completedAt).toLocaleString("pt-BR") : "Data registrada"}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 py-3 px-4 rounded-full bg-surface hover:bg-line-strong text-finora-600 font-bold text-xs border border-line-strong transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={15} />
                  <span>Imprimir Cupom Térmico (POS)</span>
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={15} />
                  <span>Próximo Visitante (Esc)</span>
                </button>
              </div>
            </div>

          ) : (

            <div className="flex flex-col gap-3">
              {claimData.offline && (
                <p className="rounded-xl border border-[#F5D58A] bg-[#FFF3DC] px-3 py-2 text-xs font-bold text-[#8A5D00]">
                  Sem internet: dados da lista baixada no aparelho. A entrega será enviada quando a conexão voltar.
                </p>
              )}

              {!claimData.hasMeeting && (
                <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400 text-sm font-bold flex flex-col items-center justify-center gap-1 text-center">
                  <AlertTriangle size={24} className="mb-1" />
                  <span>Agendamento Pendente!</span>
                  <p className="text-xs font-normal text-rose-400 mt-1">
                    Para liberar este prêmio, o participante precisa estar agendado. Use o botão abaixo para auto-agendar o próximo horário.
                  </p>
                </div>
              )}

              <button
                type="button"
                disabled={claiming || !claimData.hasMeeting}
                onClick={handleConfirmDelivery}
                className={`w-full py-4 px-6 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
                  claimData.hasMeeting
                    ? "bg-finora-600 hover:bg-finora-700 text-white hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-surface text-text-2 border border-line-strong cursor-not-allowed"
                }`}
              >
                {claiming ? (
                  <LoaderCircle size={20} className="animate-spin" />
                ) : (
                  <PackageCheck size={22} />
                )}
                <span>
                  {claimData.hasMeeting ? "CONFIRMAR ENTREGA DO BRINDE (Enter)" : "AGENDAMENTO OBRIGATÓRIO"}
                </span>
              </button>

              {(!claimData.hasMeeting || claimData.prizeName.toLowerCase().includes("vip") || claimData.prizeName.toLowerCase().includes("consultoria")) && (
                <button
                  type="button"
                  onClick={handleAutoBookVIP}
                  className="w-full py-4 px-6 rounded-2xl bg-surface hover:bg-line-strong text-finora-600 font-black text-sm transition-all flex items-center justify-center gap-2 border border-line-strong"
                >
                  <CalendarDays size={18} />
                  <span>Auto-Agendar Próximo Horário VIP Livre</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="py-2.5 text-xs text-text-2 hover:text-text transition-colors"
              >
                Cancelar e buscar outro PIN (Esc)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
