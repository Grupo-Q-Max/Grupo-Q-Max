"use client";

import { useEffect, useState } from "react";
import { Printer, Smartphone, Sparkles, Gift, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { assetUrl } from "@/components/brand/Brand";

type Props = {
  eventName: string;
  route: string;
};

export default function StandDisplayView({ eventName, route }: Props) {
  const [fullTargetUrl, setFullTargetUrl] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const target = `${origin}/finora-experience/${route}/cadastro`;
      setFullTargetUrl(target);
    }
  }, []);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-text font-sans p-4 print:p-0 print:text-black print:bg-white">
      {/* Barra Superior de Ações (Oculta na Impressão) */}
      <div className="w-full max-w-2xl flex items-center justify-between gap-3 bg-surface border border-line p-4 rounded-2xl backdrop-blur mb-6 print:hidden">
        <Link
          href="/admin"
          className="flex items-center gap-2 text-xs font-semibold text-text-2 hover:text-text transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Voltar ao Dashboard</span>
        </Link>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-bold text-xs transition-all"
        >
          <Printer size={16} />
          <span>IMPRIMIR PLACA DO STAND (A4)</span>
        </button>
      </div>

      {/* Folha A4 para Display de Acrílico no Stand */}
      <div className="w-full max-w-xl bg-white text-text border-2 border-line rounded-3xl p-8 md:p-12 text-center flex flex-col items-center justify-between print:border-none print:shadow-none print:w-full print:max-w-none print:min-h-screen print:rounded-none">
        {/* Cabeçalho */}
        <div className="w-full flex flex-col items-center">
          {/* Logos Oficiais: Grupo Q-Max e Finora */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl("/brands/grupo-qmax-dark.png")} alt="Grupo Q-Max" className="h-7 w-auto object-contain" />
            <span className="h-5 w-px bg-slate-300" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl("/brands/finora-logo-horizontal.png")} alt="Finora" className="h-7 w-auto object-contain" />
          </div>

          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-black tracking-widest uppercase mb-3 border border-cyan-500/30 shadow-xs">
            <Sparkles size={14} className="text-[#8A4B00]" />
            FINORA EXPERIENCE • {eventName || "SUMMIT CLINICORP"}
          </div>

          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-text mt-1">
            Gire a Roleta e Ganhe Brindes!
          </h1>
          <p className="text-sm md:text-base font-semibold text-text-2 mt-2 max-w-md">
            Aponte a câmera, preencha seus dados em 30 segundos e gire a roleta oficial no estande:
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-extrabold shadow-2xs">
            <span>👑</span>
            <span>Grandes Clínicas (6+ cad.) e Mentorados: Prêmios VIP no Estande</span>
          </div>
        </div>

        {/* QR Code Gigante em Moldura Nobre */}
        <div className="my-5 p-3.5 bg-gradient-to-br from-finora-600 via-finora-700 to-indigo-700 rounded-3xl shadow-xl">
          <div className="bg-white p-4 rounded-2xl flex flex-col items-center shadow-inner">
            {fullTargetUrl ? (
              <QRCodeSVG
                value={fullTargetUrl}
                size={260}
                level="Q"
                marginSize={2}
                title="QR Code de Cadastro"
                className="w-56 h-56 md:w-64 md:h-64 rounded-xl"
              />
            ) : (
              <div className="w-56 h-56 md:w-64 md:h-64 bg-paper animate-pulse rounded-xl" />
            )}

            <div className="mt-2.5 flex items-center gap-1.5 text-xs font-mono font-black text-finora-700 tracking-wider">
              <Smartphone size={14} />
              <span>APONTE A CÂMERA DO CELULAR</span>
            </div>
          </div>
        </div>

        {/* Passos de Participação */}
        <div className="w-full grid grid-cols-3 gap-3 my-3 text-left">
          <div className="bg-[#F8FAFC] border border-line p-3.5 rounded-2xl">
            <span className="text-xs font-black text-finora-600 block mb-1">01. CÂMERA</span>
            <p className="text-xs font-medium text-text-2 leading-snug">
              Aponte seu celular para o QR Code acima.
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-line p-3.5 rounded-2xl">
            <span className="text-xs font-black text-finora-600 block mb-1">02. CADASTRO</span>
            <p className="text-xs font-medium text-text-2 leading-snug">
              Preencha seus dados em 30 segundos.
            </p>
          </div>

          <div className="bg-[#F8FAFC] border border-line p-3.5 rounded-2xl">
            <span className="text-xs font-black text-emerald-400 block mb-1">03. GIRE & GANHE</span>
            <p className="text-xs font-medium text-text-2 leading-snug">
              Gire a roleta e retire seu brinde no balcão!
            </p>
          </div>
        </div>

        {/* Rodapé da Placa */}
        <div className="w-full pt-3.5 border-t border-line flex items-center justify-between text-xs text-text-2 font-semibold">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetUrl("/brands/finora-symbol.png")} alt="Finora" className="h-4 w-4 object-contain" />
            <span className="font-bold text-text">Finora • Grupo Q-Max</span>
          </div>
          <span className="font-mono text-[10px] text-text-2 truncate max-w-xs">{fullTargetUrl}</span>
        </div>
      </div>
    </div>
  );
}
