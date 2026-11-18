"use client";

import { Crown, Sparkles, ShieldCheck, Printer, Check, Copy, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { FinoraLogo, assetUrl } from "@/components/brand/Brand";
import { renderGoldenTicketCanvas } from "@/lib/ticket-export";

export type GoldenTicketProps = {
  code: string;
  eventName: string;
  eventSlug: string;
  participantName?: string | null;
  ticketNumber?: string | number | null;
  redeemedAt?: string | null;
  showPrintButton?: boolean;
  className?: string;
};

export default function GoldenTicket({
  code,
  eventName,
  eventSlug,
  participantName,
  ticketNumber,
  redeemedAt,
  showPrintButton = true,
  className = "",
}: GoldenTicketProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownloadImage() {
    setDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      let logoImg: HTMLImageElement | null = null;
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((res) => {
          img.onload = () => res(img);
          img.onerror = () => res(null);
          img.src = assetUrl("/brands/finora-symbol.png");
        });
        if (img.complete && img.naturalWidth > 0) {
          logoImg = img;
        }
      } catch {}

      await renderGoldenTicketCanvas(
        canvas,
        { code, participantName, redeemedAt },
        eventName,
        eventSlug,
        logoImg
      );

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `bilhete-vip-${code.replace(/\W+/g, "")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Erro ao baixar imagem do bilhete:", e);
    } finally {
      setDownloading(false);
    }
  }

  // Se o bilhete já foi emitido com PIN de participação, o QR abre direto a roleta; senão abre o cadastro pré-preenchido
  const siteOrigin =
    typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
      ? window.location.origin
      : "https://grupoqmax.com.br";
  const rawTicketNum = ticketNumber ? String(ticketNumber).replace(/\D/g, "") : null;
  const activationUrl = rawTicketNum
    ? `${siteOrigin}/finora-experience/${eventSlug}/roleta?pin=${rawTicketNum}&vip=${encodeURIComponent(code)}`
    : `${siteOrigin}/finora-experience/${eventSlug}/cadastro?vip=${encodeURIComponent(code)}`;

  const formattedTicket = ticketNumber
    ? typeof ticketNumber === "number"
      ? `#${String(ticketNumber).padStart(4, "0")}`
      : ticketNumber.startsWith("#")
      ? ticketNumber
      : `#${ticketNumber}`
    : null;

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {/* O Bilhete Dourado */}
      <div
        id={`golden-ticket-${code}`}
        className="golden-ticket-card relative w-full max-w-[660px] overflow-hidden rounded-3xl p-1.5 select-none shadow-[0_22px_60px_rgba(255,185,0,0.45)] transition-all duration-300 hover:shadow-[0_28px_75px_rgba(255,215,0,0.65)]"
        style={{
          background:
            "linear-gradient(135deg, #FFF9B8 0%, #FFD700 22%, #FF9900 48%, #FFF085 68%, #CC7A00 88%, #FFD700 100%)",
        }}
      >
        {/* Shimmer Effect Passante */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[golden-sweep_3.5s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent)]"
        />

        {/* Corpo Interno com moldura dourada e entalhes de bilhete */}
        <div className="relative flex flex-col md:flex-row items-stretch rounded-[22px] bg-[#090E1C] text-[#F7F9FC] border-2 border-[#FFD700]/50">
          {/* Lado Esquerdo / Principal do Bilhete */}
          <div className="relative flex flex-1 flex-col justify-between p-6 md:p-7 overflow-hidden">
            {/* Padrão geométrico de fundo estilo cédula/segurança */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[radial-gradient(#FFD700_1.5px,transparent_1.5px)] [background-size:16px_16px]"
            />

            {/* Cabeçalho do Bilhete */}
            <div className="relative z-10 flex items-center justify-between gap-2 border-b border-[#FFD700]/35 pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <FinoraLogo variant="symbol" height={32} className="h-8 w-auto shrink-0" />
                <span className="h-5 w-px bg-[#FFD700]/50 shrink-0" />
                <span className="font-mono text-[11px] font-black tracking-widest text-[#FFF4A3] uppercase whitespace-nowrap truncate">
                  Finora Experience
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#FFD700] bg-gradient-to-r from-[#FFD700]/30 to-[#FF9900]/40 px-3 py-1.5 shadow-[0_0_18px_rgba(255,215,0,0.35)] shrink-0 whitespace-nowrap">
                <Crown size={14} className="text-[#FFE57F] shrink-0" />
                <span className="font-mono text-[10.5px] sm:text-xs font-black tracking-wider text-[#FFF59D] uppercase whitespace-nowrap">
                  BILHETE DOURADO · VIP
                </span>
              </div>
            </div>

            {/* Conteúdo Central */}
            <div className="relative z-10 my-4 flex flex-col gap-2.5">
              <span className="font-mono text-xs font-extrabold tracking-widest text-[#FFD700] uppercase">
                {eventName}
              </span>
              <h3 className="font-display text-2xl sm:text-3xl md:text-[34px] font-black tracking-tight text-white leading-[1.15]">
                Passe Oficial do Mentorado
              </h3>
              <p className="text-xs sm:text-[13.5px] text-[#C2CEE3] leading-relaxed max-w-sm">
                Acesso exclusivo ao <strong className="text-[#FFD700] font-black">Pool de Prêmios VIP</strong> e cupom oficial registrado para o Grande Sorteio no Telão.
              </p>

              {/* Destaque solicitado: Escaneie o QR CODE ao lado e concorra a um fotopolimerizador ! */}
              <div className="mt-1 flex items-center gap-2.5 rounded-xl border-2 border-[#FFD700] bg-gradient-to-r from-[#FFD700]/30 via-[#FF9900]/25 to-[#FFD700]/30 px-3.5 py-2.5 shadow-[0_0_22px_rgba(255,215,0,0.3)]">
                <Sparkles size={18} className="text-[#FFD700] shrink-0 animate-pulse" />
                <span className="font-display text-xs sm:text-[13.5px] font-black tracking-wide text-[#FFF9B8] uppercase leading-tight drop-shadow-sm">
                  Escaneie o QR CODE ao lado e concorra a um fotopolimerizador !
                </span>
              </div>
            </div>

            {/* Nome do Mentorado / Portador & Status */}
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 border-t border-[#FFD700]/30 pt-4">
              <div className="flex flex-col">
                <span className="font-mono text-[11px] font-bold text-[#A7B2C6] uppercase tracking-wider">
                  Portador Credenciado
                </span>
                <span className="font-display text-lg sm:text-xl font-black text-white">
                  {participantName || "Mentorado Convidado"}
                </span>
              </div>

              {formattedTicket && (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[11px] font-bold text-[#FFD700] uppercase tracking-wider">
                    Cupom Telão
                  </span>
                  <span className="font-mono text-2xl sm:text-3xl font-black text-[#FFD700] tracking-wider drop-shadow-[0_0_14px_rgba(255,215,0,0.55)]">
                    {formattedTicket}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Divisor Perfurado / Stub Notch */}
          <div className="relative flex md:flex-col items-center justify-between py-2 md:py-0 px-4 md:px-0 bg-[#090E1C]">
            {/* Recorte circular superior/esquerdo */}
            <div className="size-6 rounded-full bg-[#FFD700] -mt-3 md:-mt-3 -ml-3 md:ml-0 md:-top-3 shadow-inner" />

            {/* Linha pontilhada de picote */}
            <div className="flex-1 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-[#FFD700]/50 w-full md:w-0 h-0 md:h-full my-1.5 md:my-0" />

            {/* Recorte circular inferior/direito */}
            <div className="size-6 rounded-full bg-[#FFD700] -mb-3 md:-mb-3 -mr-3 md:mr-0 md:-bottom-3 shadow-inner" />
          </div>

          {/* Lado Direito / Canhoto com QR Code & Código */}
          <div className="relative flex flex-col items-center justify-between p-6 md:p-7 md:w-[220px] shrink-0 bg-gradient-to-b from-[#111A2E] via-[#0C1222] to-[#080D1A] rounded-b-[21px] md:rounded-b-none md:rounded-r-[21px] border-t md:border-t-0 md:border-l border-[#FFD700]/30">
            <div className="flex flex-col items-center text-center">
              <span className="font-mono text-xs font-black text-[#FFD700] uppercase tracking-wider">
                {ticketNumber ? "Escanear para Girar" : "Escanear para Ativar"}
              </span>

              {/* QR Code com borda dourada estilizada mais forte */}
              <div className="mt-2 rounded-2xl bg-white p-2.5 shadow-[0_0_25px_rgba(255,215,0,0.35)] border-3 border-[#FFD700]">
                <QRCodeSVG
                  value={activationUrl}
                  size={116}
                  level="M"
                  includeMargin={false}
                  fgColor="#080D1A"
                />
              </div>
              <span className="mt-1.5 text-[10px] text-[#C2CEE3] font-bold leading-tight">
                Abre cadastro com código pronto
              </span>
            </div>

            {/* Código Numérico / Alfanumérico bem maior estilo cupom */}
            <div className="mt-3.5 flex flex-col items-center">
              <span className="font-mono text-[10px] font-black text-[#A7B2C6] uppercase tracking-widest">
                BILHETE VIP
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-black tracking-widest text-[#FFD700] select-all drop-shadow-[0_0_12px_rgba(255,215,0,0.5)]">
                {code.startsWith("#") ? code : `#${code}`}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-400">
                <ShieldCheck size={13} /> {redeemedAt ? "Resgatado" : "Válido p/ 1 Giro"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Botões de Ação Auxiliares (Não aparecem na impressão) */}
      <div className="no-print flex flex-wrap items-center justify-center gap-2.5 text-xs">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 py-2 font-semibold text-text shadow-sm transition-all hover:bg-paper active:scale-95 cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-600" />
              <span>Link Copiado!</span>
            </>
          ) : (
            <>
              <Copy size={14} className="text-text-2" />
              <span>Copiar Link do Bilhete</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadImage}
          disabled={downloading}
          className="flex items-center gap-1.5 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#FFF5C0] to-[#FFE082] px-4 py-2 font-bold text-[#5C4000] shadow-sm transition-all hover:brightness-105 active:scale-95 cursor-pointer disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 size={14} className="animate-spin text-[#5C4000]" />
              <span>Gerando PNG…</span>
            </>
          ) : (
            <>
              <Download size={14} className="text-[#B8860B]" />
              <span>Baixar Imagem (.png)</span>
            </>
          )}
        </button>

        {showPrintButton && (
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-4 py-2 font-bold text-[#0C1222] shadow-md transition-all hover:brightness-110 active:scale-95 cursor-pointer"
          >
            <Printer size={14} />
            <span>Imprimir Bilhete Dourado</span>
          </button>
        )}
      </div>

      {/* Estilos CSS para animação de Shimmer e Impressão Gráfica */}
      <style jsx global>{`
        @keyframes golden-sweep {
          0% {
            transform: translateX(-150%) skewX(-25deg);
          }
          50% {
            transform: translateX(250%) skewX(-25deg);
          }
          100% {
            transform: translateX(250%) skewX(-25deg);
          }
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          .golden-ticket-card,
          .golden-ticket-card * {
            visibility: visible !important;
          }
          .golden-ticket-card {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) scale(1.05) !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
