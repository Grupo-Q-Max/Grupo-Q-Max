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
  const [qrUrl, setQrUrl] = useState("");
  const [privacyMode, setPrivacyMode] = useState(true);
  const [isStandby, setIsStandby] = useState(false);
  const lastMilestoneRef = useRef(0);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  useEffect(() => {
    setQrUrl(`${window.location.origin}/finora-experience/${event.route}/cadastro`);
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "n") setIsStandby((v) => !v);
      else if (k === "f") toggleFullscreen();
      else if (k === "l") setPrivacyMode((v) => !v);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const qr = (size: number) => (
    <div className="rounded-[22px] bg-white p-6" role="img" aria-label="QR Code para cadastro">
      {qrUrl ? <QRCodeSVG value={qrUrl} size={size} level="M" /> : <div style={{ width: size, height: size }} />}
    </div>
  );

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

  if (isStandby) {
    return (
      <TvCanvas className="grid grid-rows-[auto_minmax(0,1fr)] gap-12 px-18 py-14">
        {header}
        <div className="flex flex-col justify-center gap-8">
          <h1 className="font-display text-[150px] leading-[0.9] font-extrabold tracking-[-0.045em]">
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
      <TvCanvas className="grid grid-cols-[minmax(0,1fr)_640px] grid-rows-[auto_minmax(0,1fr)] gap-x-20 gap-y-12 px-18 py-14">
        {header}
        <div className="flex flex-col justify-center gap-14">
          <h1 className="font-display text-[150px] leading-[0.9] font-extrabold tracking-[-0.045em]">
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
          <ol className="flex flex-col gap-6">
            {[
              "Aponte a câmera para o QR Code",
              "Confirme pelo link no WhatsApp",
              isCofre ? "Abra o cofre aqui no estande e leve um brinde" : "Gire aqui no estande e leve um brinde",
            ].map((t, i) => (
              <li key={t} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-6 text-[40px] font-semibold">
                <span className="flex size-18 items-center justify-center rounded-full border-[3px] border-accent font-mono text-[32px] text-accent">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <aside className="flex flex-col items-center justify-center gap-8 rounded-[32px] bg-accent p-12 text-center text-ink-950">
          {qr(412)}
          <span className="text-[36px] font-bold">
            {isCofre ? "Toda tentativa ganha um brinde" : "Todo giro ganha um brinde"}
          </span>
        </aside>
        {controls}
      </TvCanvas>
    );
  }

  const [latest, ...rest] = winners;
  return (
    <TvCanvas className="grid grid-cols-[minmax(0,1fr)_560px] grid-rows-[auto_minmax(0,1fr)] gap-x-16 gap-y-12 px-18 py-14">
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
      <aside className="flex flex-col gap-7">
        <div className="flex flex-1 flex-col items-center justify-center gap-7 rounded-[28px] bg-accent p-10 text-center text-ink-950">
          <span className="font-display text-[54px] leading-none font-extrabold tracking-[-0.03em]">
            {isCofre ? "Sua vez no cofre" : "Sua vez de girar"}
          </span>
          {qr(312)}
          <span className="text-[30px] font-semibold">Aponte a câmera do celular</span>
        </div>
        <div className="flex flex-col gap-2 rounded-[28px] border border-ink-line bg-ink-800 px-8 py-7">
          <span className="font-mono text-xl tracking-[0.08em] text-ink-text-2">SORTEIO GERAL</span>
          <span className="text-[34px] font-bold">Todo cadastro concorre</span>
          <span className="text-[26px] text-ink-text-2">No encerramento, aqui no estande</span>
        </div>
      </aside>
      {controls}
    </TvCanvas>
  );
}
