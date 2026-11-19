"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Maximize, Moon, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getApiBaseUrl } from "@/lib/api-client";
import { useLiveEvent } from "@/lib/use-live-event";
import { FinoraLogo, QmaxBrandLogo, type EventTheme } from "@/components/brand/Brand";
import TvCanvas, { LiveBadge } from "./TvCanvas";
import { RARITY, getPrizeRarity } from "./rarity";

type Winner = {
  drawId: number;
  drawnAt: string;
  prize: { id: number; name: string; imageUrl?: string | null };
  participant: { id: number; name: string; cpfLastDigits: string; clinicName?: string | null; city?: string | null };
};

type DashboardData = {
  event: { id: number; name: string };
  summary: { totalParticipations: number; approved: number; drawsCount: number };
  latestWinners: Winner[];
};

function formatLgpdName(name = "", privacyEnabled = true) {
  if (!privacyEnabled || !name) return name;
  const parts = name.trim().split(" ");
  if (parts.length <= 1) return name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function RarityText({ name }: { name: string }) {
  const r = RARITY[getPrizeRarity(name)];
  const color = { "★★★": "#FFB27F", "★★": "#C9B8FF", "★": "#A9D0FF", "": "#C7D0DF" }[r.stars];
  return (
    <span className="text-[26px] font-bold whitespace-nowrap" style={{ color }}>
      {r.stars && `${r.stars} `}
      {r.label}
    </span>
  );
}

// Telão ao vivo do estande (TV 16:9).
export default function LiveScreen({ event, eventId }: { event: EventTheme; eventId: number }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [qrUrl, setQrUrl] = useState(`https://eventos.finora.com.br/finora-experience/${event.route}/cadastro`);
  const [meetingQrUrl, setMeetingQrUrl] = useState(`https://eventos.finora.com.br/finora-experience/${event.route}/agendamento`);
  const [privacyMode, setPrivacyMode] = useState(true);
  const [isStandby, setIsStandby] = useState(false);
  const lastMilestoneRef = useRef(0);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setQrUrl(`${origin}/finora-experience/${event.route}/cadastro`);
      setMeetingQrUrl(`${origin}/finora-experience/${event.route}/agendamento`);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "n") setIsStandby((v) => !v);
      else if (k === "f") toggleFullscreen();
      else if (k === "l") setPrivacyMode((v) => !v);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [event.route]);

  async function fetchDashboard(id: number) {
    try {
      const dashRes = await fetch(`${getApiBaseUrl()}/dashboard/event/${id}/public`);
      if (dashRes.ok) setData(await dashRes.json());
    } catch {
      // Silencioso em caso de erro momentâneo no telão
    }
  }

  useEffect(() => {
    fetchDashboard(eventId);
  }, [eventId]);

  // Atualiza na hora a cada cadastro/giro (SSE), em vez de polling de 8s.
  useLiveEvent(eventId, () => fetchDashboard(eventId));

  const winners = data?.latestWinners || [];
  const totalDraws = data?.summary?.drawsCount || winners.length;

  // Confete a cada 25 brindes entregues.
  useEffect(() => {
    if (totalDraws > 0 && totalDraws % 25 === 0 && totalDraws !== lastMilestoneRef.current) {
      lastMilestoneRef.current = totalDraws;
      const accent = getComputedStyle(document.querySelector("[data-event]") ?? document.documentElement).getPropertyValue("--event-accent");
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 }, colors: [accent.trim() || "#22C3DC", "#0077FF"], disableForReducedMotion: true });
    }
  }, [totalDraws]);

  const header = (
    <header className="col-span-full flex items-center justify-between">
      <div className="flex items-center gap-6">
        <QmaxBrandLogo height={42} />
        <span className="h-11 w-0.5 bg-ink-line" />
        <FinoraLogo height={42} />
        <span className="h-11 w-0.5 bg-ink-line" />
        <span className="font-mono text-[26px] tracking-[0.08em] text-accent uppercase">{event.label}</span>
      </div>
      <div className="flex items-center gap-8">
        {totalDraws > 0 && (
          <span className="text-[30px] text-ink-text-2">
            <strong className="font-display text-[44px] text-ink-text">{totalDraws}</strong> {totalDraws === 1 ? "brinde entregue" : "brindes entregues"}
          </span>
        )}
        {!isStandby && <LiveBadge />}
      </div>
    </header>
  );

  const qr = (size: number, customUrl?: string) => {
    const targetUrl = customUrl || qrUrl;
    return (
      <div className="rounded-[22px] bg-white p-5 shadow-2xl shrink-0 flex items-center justify-center" role="img" aria-label="QR Code">
        {targetUrl ? <QRCodeSVG value={targetUrl} size={size} level="M" /> : <div style={{ width: size, height: size }} />}
      </div>
    );
  };

  // Controles discretos para quem opera a TV sem teclado.
  const controls = (
    <div className="absolute right-6 bottom-4 flex gap-2 opacity-0 transition-opacity duration-[180ms] focus-within:opacity-100 hover:opacity-100">
      {[
        { label: privacyMode ? "LGPD: nomes abreviados (L)" : "LGPD: nomes completos (L)", icon: ShieldCheck, onClick: () => setPrivacyMode((v) => !v) },
        { label: "Encerrar o dia (N)", icon: Moon, onClick: () => setIsStandby((v) => !v) },
        { label: "Tela cheia (F)", icon: Maximize, onClick: toggleFullscreen },
      ].map(({ label, icon: Icon, onClick }) => (
        <button key={label} type="button" onClick={onClick} className="flex h-12 items-center gap-2 rounded-full border border-ink-line px-4 text-lg text-ink-text-2">
          <Icon size={20} /> {label}
        </button>
      ))}
    </div>
  );

  const isCofre = event.experience === "COFRE";

  const asideCards = (
    <aside className="flex flex-col justify-between gap-4" style={{ width: "580px", height: "870px" }}>
      {/* CARD 1: CADASTRO NORMAL & 1º GIRO */}
      <div
        className="flex items-center justify-between gap-6 rounded-[28px] border border-accent/40 bg-gradient-to-br from-ink-900/90 via-ink-950 to-ink-900/80 p-6 text-white shadow-xl relative overflow-hidden"
        style={{ height: "370px" }}
      >
        <div className="flex flex-1 flex-col justify-between h-full py-1">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent/15 border border-accent/30 px-3.5 py-1 font-mono text-[13px] font-bold uppercase tracking-wider text-accent">
              1º PASSO · NOVO NO ESTANDE
            </span>
            <h2 className="font-display text-[32px] font-extrabold leading-tight tracking-tight text-white mt-1">
              {isCofre ? "Abra o Cofre" : "Gire a Roleta"}
            </h2>
            <p className="text-[17px] leading-snug text-slate-300">
              {isCofre ? "Toda tentativa leva um brinde especial da Finora!" : "Todo giro ganha um brinde exclusivo Finora Experience!"}
            </p>
          </div>
          <span className="text-[15px] font-semibold text-accent flex items-center gap-1.5">
            📲 Aponte a câmera para cadastrar
          </span>
        </div>
        {qr(180, qrUrl)}
      </div>

      {/* CARD 2: VIP · BATE-PAPO COM O CEO HUGO & ROLETA VIP */}
      <div
        className="flex items-center justify-between gap-6 rounded-[28px] border-2 border-[#FFD700] bg-gradient-to-br from-[#2B1B04]/90 via-[#181105]/95 to-[#0B0802]/95 p-6 text-white shadow-[0_0_40px_rgba(255,215,0,0.35)] relative overflow-hidden"
        style={{ height: "480px" }}
      >
        <div className="flex flex-1 flex-col justify-between h-full py-1">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#FFD700]/20 border border-[#FFD700]/50 px-3.5 py-1 font-mono text-[13px] font-black uppercase tracking-wider text-[#FFE57F]">
              👑 2º PASSO · EXECUTIVO
            </span>
            <h2 className="font-display text-[34px] font-black leading-tight tracking-tight text-[#FFF4A3] mt-1">
              Libere a Roleta VIP
            </h2>
            <p className="text-[16px] leading-snug text-amber-100/90 font-medium">
              Agende sua consultoria de 45 min com <strong>Hugo Werninghaus (CEO)</strong> e destrave o <strong>2º Giro VIP</strong>!
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] font-black text-[#FFD700] flex items-center gap-1.5">
              📅 Já se cadastrou? Aponte para agendar
            </span>
            <span className="inline-block text-[12.5px] font-semibold text-amber-200/90 bg-amber-500/15 border border-amber-400/30 px-2.5 py-1 rounded-lg">
              ⭐ Vagas até Janeiro de 2027 · Prêmio válido pós-reunião
            </span>
          </div>
        </div>
        {qr(200, meetingQrUrl)}
      </div>
    </aside>
  );

  if (isStandby) {
    return (
      <TvCanvas
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr",
          rowGap: "3rem",
          padding: "3.5rem 4.5rem",
          width: "1920px",
          height: "1080px",
        }}
      >
        {header}
        <div className="flex flex-col justify-center gap-8">
          <h1 className="font-display font-extrabold tracking-[-0.045em]" style={{ fontSize: "140px", lineHeight: "0.95" }}>
            Encerramos
            <br />
            <span className="text-accent">por hoje.</span>
          </h1>
          <p className="text-[40px] text-ink-text-2">
            {isCofre
              ? "Obrigado pela visita. Voltamos amanhã com novas chances no cofre."
              : "Obrigado pela visita. Voltamos amanhã com novos giros."}
          </p>
        </div>
        {controls}
      </TvCanvas>
    );
  }

  if (winners.length === 0) {
    return (
      <TvCanvas
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 580px",
          gridTemplateRows: "auto 1fr",
          columnGap: "4rem",
          rowGap: "2.5rem",
          padding: "3rem 4.5rem",
          width: "1920px",
          height: "1080px",
        }}
      >
        {header}
        <div className="flex flex-col justify-center gap-10" style={{ maxWidth: "1150px" }}>
          <h1
            className="font-display font-extrabold tracking-[-0.04em] text-white"
            style={{ fontSize: "100px", lineHeight: "0.95" }}
          >
            {isCofre ? (
              <>
                O cofre está
                <br />
                esperando
                <br />
                <span className="text-accent">o primeiro.</span>
              </>
            ) : (
              <>
                A roleta está
                <br />
                esperando
                <br />
                <span className="text-accent">o primeiro.</span>
              </>
            )}
          </h1>
          <ol className="flex flex-col gap-6" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {[
              "Aponte a câmera para o QR Code ao lado",
              "Seu giro é liberado imediatamente no tablet do estande",
              isCofre ? "Abra o cofre aqui no estande e leve um brinde" : "Gire aqui no estande e leve um brinde",
            ].map((t, i) => (
              <li key={t} className="flex items-center gap-6 font-semibold" style={{ fontSize: "38px" }}>
                <span
                  className="flex items-center justify-center rounded-full border-[3px] border-accent font-mono text-accent shrink-0"
                  style={{ width: "68px", height: "68px", fontSize: "32px", fontWeight: "bold" }}
                >
                  {i + 1}
                </span>
                <span className="text-slate-100">{t}</span>
              </li>
            ))}
          </ol>
        </div>
        {asideCards}
        {controls}
      </TvCanvas>
    );
  }

  const [latest, ...rest] = winners;
  return (
    <TvCanvas
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 580px",
        gridTemplateRows: "auto 1fr",
        columnGap: "4rem",
        rowGap: "2.5rem",
        padding: "3rem 4.5rem",
        width: "1920px",
        height: "1080px",
      }}
    >
      {header}
      <main className="flex min-h-0 flex-col gap-8">
        <div className="flex flex-col gap-3.5 rounded-[28px] border border-ink-line bg-ink-800 px-12 py-10">
          <span className="font-mono text-[22px] tracking-[0.08em] text-ink-text-2">ACABOU DE GANHAR</span>
          <span className="truncate font-display text-[96px] leading-none font-extrabold tracking-[-0.04em]">
            {formatLgpdName(latest.participant?.name || "Visitante", privacyMode)}
          </span>
          <div className="flex items-center gap-5 text-[36px]">
            <RarityText name={latest.prize.name} />
            <span className="truncate">{latest.prize.name}</span>
          </div>
        </div>
        <div className="flex flex-col px-2">
          {rest.slice(0, 4).map((w) => (
            <div key={w.drawId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-ink-700 py-5.5 last:border-b-0">
              <span className="truncate text-[38px] font-semibold">
                {formatLgpdName(w.participant?.name || "Visitante", privacyMode)}{" "}
                <span className="font-normal text-ink-text-2">· {w.prize.name}</span>
              </span>
              <RarityText name={w.prize.name} />
            </div>
          ))}
        </div>
      </main>
      {asideCards}
      {controls}
    </TvCanvas>
  );
}
