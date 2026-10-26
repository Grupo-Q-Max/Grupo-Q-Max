"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { EventTag, FinoraLogo, type EventTheme } from "@/components/brand/Brand";

const WHEEL =
  "conic-gradient(from -22.5deg,#18233B 0deg 45deg,#24314F 45deg 90deg,var(--event-accent) 90deg 135deg,#18233B 135deg 180deg,#24314F 180deg 225deg,#0077FF 225deg 270deg,#18233B 270deg 315deg,#24314F 315deg 360deg)";

// Landing do quiosque. Adapta automaticamente para Roleta ou Cofre.
export default function StageLanding({ event }: { event: EventTheme }) {
  const href = `/${event.route}/cadastro`;
  const [qrUrl, setQrUrl] = useState("");
  const isCofre = event.experience === "COFRE";

  useEffect(() => {
    setQrUrl(`${window.location.origin}/finora-experience${href}`);
  }, [href]);

  const steps = isCofre
    ? ["Cadastro rápido", "Código no estande", "Abra o cofre e retire o brinde"]
    : ["Cadastro rápido", "Código no estande", "Gire e retire o brinde"];

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink-950 text-ink-text">
      {isCofre ? (
        <div
          aria-hidden="true"
          className="absolute rounded-full border-[18px] border-ink-800 flex items-center justify-center
            shadow-[0_0_90px_rgba(245,179,1,0.22),inset_0_0_60px_rgba(0,0,0,0.8)]
            portrait:w-[120vw] portrait:aspect-square portrait:left-1/2 portrait:-translate-x-1/2 portrait:top-[64vh]
            landscape:h-[105vh] landscape:aspect-square landscape:top-1/2 landscape:-translate-y-1/2 landscape:right-[-52vh]
            bg-gradient-to-br from-ink-900 via-ink-800 to-ink-950"
        >
          {/* Aneis e dial do cofre */}
          <div className="absolute inset-8 rounded-full border-[3px] border-dashed border-accent/40 animate-[spin_160s_linear_infinite]" />
          <div className="absolute inset-16 rounded-full border-2 border-accent/25" />
          <div className="absolute inset-28 rounded-full border-[6px] border-ink-700 bg-ink-900/90 shadow-[inset_0_4px_20px_rgba(0,0,0,0.9)] flex items-center justify-center">
            <div className="size-32 rounded-full border-4 border-accent bg-gradient-to-tr from-accent-ink via-accent to-white/90 shadow-[0_0_40px_var(--event-accent)] flex items-center justify-center">
              <Lock size={48} className="text-ink-950" strokeWidth={2.4} />
            </div>
          </div>
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <span
              key={deg}
              className="absolute h-6 w-1 rounded-full bg-accent/60"
              style={{
                transform: `rotate(${deg}deg) translateY(-46vh)`,
              }}
            />
          ))}
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute rounded-full shadow-[0_0_0_14px_#18233B]
            portrait:w-[120vw] portrait:aspect-square portrait:left-1/2 portrait:-translate-x-1/2 portrait:top-[64vh]
            landscape:h-[105vh] landscape:aspect-square landscape:top-1/2 landscape:-translate-y-1/2 landscape:right-[-52vh]"
          style={{ background: WHEEL }}
        />
      )}

      <div className="relative z-10 flex min-h-dvh flex-col justify-between gap-12 px-6 py-10 sm:px-14 sm:py-12 landscape:max-w-[60%] portrait:justify-start portrait:gap-16">
        <div className="flex items-center gap-3.5">
          <FinoraLogo />
          <span className="h-6 w-px bg-ink-line" />
          <EventTag label={event.label} />
        </div>

        <div className="flex flex-col gap-7">
          <h1 className="font-display font-extrabold text-[clamp(48px,7vw,92px)] portrait:text-[min(11.5vw,96px)] leading-[0.92] tracking-[-0.045em]">
            {isCofre ? (
              <>
                Abra o cofre.
                <br />
                <span className="whitespace-nowrap text-accent">Ganhe na hora.</span>
              </>
            ) : (
              <>
                Gire a roleta.
                <br />
                <span className="whitespace-nowrap text-accent">Ganhe na hora.</span>
              </>
            )}
          </h1>
          <p className="max-w-[560px] text-2xl leading-snug text-[#C7D0DF]">
            {isCofre
              ? "Descubra o código secreto e desbloqueie brindes exclusivos no estande."
              : "E ainda leve um cupom para o Sorteio Geral no encerramento."}
          </p>
          <Link
            href={href}
            className="inline-flex h-22 items-center justify-center gap-4 self-start portrait:h-24 portrait:self-stretch portrait:text-[30px] rounded-full bg-accent px-11 text-[28px] font-bold text-ink-950 transition-transform duration-[180ms] active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-ink-text shadow-[0_10px_35px_rgba(var(--accent-rgb),0.4)]"
          >
            Começar agora <ArrowRight size={30} strokeWidth={2.4} />
          </Link>
          <div className="flex items-center gap-4 text-[17px] text-ink-text-2">
            <div className="flex-none rounded-xl bg-white p-2" role="img" aria-label="QR Code para cadastro pelo celular">
              {qrUrl ? <QRCodeSVG value={qrUrl} size={72} /> : <div className="size-18" />}
            </div>
            <span className="max-w-[300px]">Fila grande? Aponte a câmera e faça o cadastro no seu celular.</span>
          </div>
        </div>

        <ol className="hidden landscape:flex gap-7 text-[17px] text-ink-text-2">
          {steps.map((label, i) => (
            <li key={label} className="flex items-center gap-2.5">
              <span className="font-mono font-semibold text-ink-text">{i + 1}</span>
              {label}
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
