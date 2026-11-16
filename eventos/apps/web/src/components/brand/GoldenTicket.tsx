"use client";

import { Crown, Sparkles, ShieldCheck, Printer, Check, Copy } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QmaxBrandLogo } from "@/components/brand/Brand";

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
        className="golden-ticket-card relative w-full max-w-[620px] overflow-hidden rounded-3xl p-1 select-none shadow-[0_20px_50px_rgba(180,120,20,0.35)] transition-all duration-300 hover:shadow-[0_25px_65px_rgba(212,175,55,0.45)]"
        style={{
          background:
            "linear-gradient(135deg, #FDF7C3 0%, #E6C25B 20%, #B8860B 45%, #FBF5B7 65%, #996515 85%, #E6C25B 100%)",
        }}
      >
        {/* Shimmer Effect Passante */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[golden-sweep_4s_ease-in-out_infinite] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]"
        />

        {/* Corpo Interno com moldura dourada e entalhes de bilhete */}
        <div className="relative flex flex-col md:flex-row items-stretch rounded-[22px] bg-[#0C1222] text-[#F7F9FC] border border-[#F3E5AB]/40">
          {/* Lado Esquerdo / Principal do Bilhete */}
          <div className="relative flex flex-1 flex-col justify-between p-6 md:p-7 overflow-hidden">
            {/* Padrão geométrico de fundo estilo cédula/segurança */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[radial-gradient(#FFE895_1px,transparent_1px)] [background-size:14px_14px]"
            />

            {/* Cabeçalho do Bilhete */}
            <div className="relative z-10 flex items-center justify-between border-b border-[#D4AF37]/25 pb-4">
              <div className="flex items-center gap-2.5">
                <QmaxBrandLogo className="text-lg" />
                <span className="h-4 w-px bg-[#D4AF37]/40" />
                <span className="font-mono text-[10px] font-bold tracking-widest text-[#F3E5AB] uppercase">
                  Finora Experience
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-gradient-to-r from-[#D4AF37]/20 to-[#996515]/30 px-3 py-1 shadow-inner">
                <Crown size={12} className="text-[#FFDF73]" />
                <span className="font-mono text-[10px] font-black tracking-wider text-[#FFDF73] uppercase">
                  BILHETE DOURADO · VIP
                </span>
              </div>
            </div>

            {/* Conteúdo Central */}
            <div className="relative z-10 my-5 flex flex-col gap-2">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-[#D4AF37] uppercase">
                {eventName}
              </span>
              <h3 className="font-display text-2xl md:text-3xl font-black tracking-tight text-white leading-tight">
                Passe Oficial do Mentorado
              </h3>
              <p className="text-xs text-[#A7B2C6] leading-relaxed max-w-sm">
                Acesso exclusivo ao <strong className="text-[#F3E5AB]">Pool de Prêmios VIP</strong> e cupom oficial registrado para o Grande Sorteio no Telão.
              </p>
            </div>

            {/* Nome do Mentorado / Portador & Status */}
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-3 border-t border-[#D4AF37]/25 pt-4">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] text-[#A7B2C6] uppercase tracking-wider">
                  Portador Credenciado
                </span>
                <span className="font-display text-base font-extrabold text-white">
                  {participantName || "Mentorado Convidado"}
                </span>
              </div>

              {formattedTicket && (
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[10px] text-[#A7B2C6] uppercase tracking-wider">
                    Cupom Telão
                  </span>
                  <span className="font-mono text-xl font-black text-[#FFDF73] tracking-wider">
                    {formattedTicket}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Divisor Perfurado / Stub Notch */}
          <div className="relative flex md:flex-col items-center justify-between py-2 md:py-0 px-4 md:px-0 bg-[#0C1222]">
            {/* Recorte circular superior/esquerdo */}
            <div className="size-5 rounded-full bg-[#E6C25B] -mt-2.5 md:-mt-2.5 -ml-2.5 md:ml-0 md:-top-2.5" />

            {/* Linha pontilhada de picote */}
            <div className="flex-1 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-[#D4AF37]/40 w-full md:w-0 h-0 md:h-full my-1 md:my-0" />

            {/* Recorte circular inferior/direito */}
            <div className="size-5 rounded-full bg-[#E6C25B] -mb-2.5 md:-mb-2.5 -mr-2.5 md:mr-0 md:-bottom-2.5" />
          </div>

          {/* Lado Direito / Canhoto com QR Code & Código */}
          <div className="relative flex flex-col items-center justify-between p-6 md:p-7 md:w-[200px] shrink-0 bg-gradient-to-b from-[#111A2E] to-[#0A1020] rounded-b-[21px] md:rounded-b-none md:rounded-r-[21px]">
            <div className="flex flex-col items-center text-center">
              <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                {ticketNumber ? "Escanear para Girar" : "Escanear para Ativar"}
              </span>

              {/* QR Code com borda dourada estilizada */}
              <div className="mt-2.5 rounded-xl bg-white p-2.5 shadow-[0_0_20px_rgba(212,175,55,0.25)] border-2 border-[#D4AF37]">
                <QRCodeSVG
                  value={activationUrl}
                  size={104}
                  level="M"
                  includeMargin={false}
                  fgColor="#0C1222"
                />
              </div>
              <span className="mt-1 text-[9px] text-[#A7B2C6] font-medium leading-tight">
                Abre cadastro com código pronto
              </span>
            </div>

            {/* Código Numérico / Alfanumérico */}
            <div className="mt-3 flex flex-col items-center">
              <span className="font-mono text-[9px] text-[#A7B2C6] uppercase tracking-widest">
                BILHETE VIP
              </span>
              <span className="font-mono text-xl font-black tracking-widest text-[#FFDF73] select-all">
                {code.startsWith("#") ? code : `#${code}`}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <ShieldCheck size={11} /> {redeemedAt ? "Resgatado" : "Válido p/ 1 Giro"}
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
