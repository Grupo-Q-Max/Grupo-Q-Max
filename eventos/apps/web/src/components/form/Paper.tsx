import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, CircleAlert, Gift, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { EventTag, FinoraLogo, QmaxBrandLogo, eventStyle, type EventTheme } from "@/components/brand/Brand";

// Casca das telas do visitante no celular e desktop (ambiente Dark Luxury Split-Hero).
export function PaperShell({
  event,
  backHref,
  right,
  children,
}: {
  event?: EventTheme;
  backHref?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className="relative min-h-dvh bg-paper text-text selection:bg-[#22C3DC]/30 selection:text-white"
      data-event={event?.route}
      style={eventStyle(event)}
    >
      {/* Ambient decorative glow behind card */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 h-[550px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,195,220,0.12)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-10%] left-1/4 h-[500px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,rgba(217,15,129,0.10)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute top-1/3 right-[-5%] h-[450px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,rgba(0,119,255,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-dvh max-w-[1240px] flex-col lg:flex-row lg:items-center lg:justify-between lg:gap-14 lg:px-8 lg:py-12">
        {/* Left Column: Desktop Hero Showcase */}
        <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-between lg:gap-8 lg:py-6">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <QmaxBrandLogo height={26} />
              <span className="h-5 w-px bg-white/20" />
              <FinoraLogo height={24} />
              <span className="h-5 w-px bg-white/20" />
              <span className="font-mono text-xs font-bold tracking-[0.14em] text-[#00E5FF] uppercase">
                {event?.label || "Finora Experience"}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 backdrop-blur-md">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                  Ativação Oficial no Estande
                </span>
              </div>

              <h1 className="font-display text-[clamp(38px,3.8vw,56px)] leading-[1.04] font-black tracking-[-0.03em] text-white">
                Participe e concorra a prêmios exclusivos.
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-300">
                Preencha seus dados para liberar seu acesso à experiência interativa. Prêmios oficiais, mentorias e brindes exclusivos no estande do Grupo Q-Max e Finora.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#00E5FF]">
                  <Gift size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Brindes Oficiais</span>
                  <span className="text-xs text-slate-400">Kits VIP, copos térmicos, mochilas e itens colecionáveis.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#D90F81]">
                  <Sparkles size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Bilhete Dourado</span>
                  <span className="text-xs text-slate-400">Emissão de bilhete digital único para retirada no balcão.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-emerald-400">
                  <Zap size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Giro Instantâneo</span>
                  <span className="text-xs text-slate-400">Liberação imediata no totem ou tablet do estande.</span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-amber-400">
                  <ShieldCheck size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">Auditoria Confiável</span>
                  <span className="text-xs text-slate-400">Sistema antifraude com validação por CPF e dispositivo.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-500">
            <span>© 2026 Grupo Q-Max & Finora</span>
            <span className="font-mono text-[11px] text-[#00E5FF]">Finora Experience Platform</span>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="flex w-full flex-col max-w-[560px] mx-auto border-x border-white/5 bg-[#070B16]/90 shadow-2xl backdrop-blur-xl lg:rounded-3xl lg:border lg:border-white/10 lg:shadow-[0_20px_70px_rgba(0,0,0,0.6)]">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#070B16]/85 px-5 backdrop-blur-md lg:rounded-t-3xl">
            <div className="flex items-center gap-1.5">
              {backHref && (
                <Link
                  href={backHref}
                  aria-label="Voltar"
                  className="-ml-2 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowLeft size={20} />
                </Link>
              )}
              <FinoraLogo className="text-2xl" />
            </div>
            {right ?? (event && <EventTag label={event.label} tone="stage" />)}
          </header>
          {children}
        </div>
      </div>
    </main>
  );
}

export function PaperHeading({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-5 pt-7 pb-4">
      {eyebrow && <div className="text-xs font-bold uppercase tracking-[0.1em] text-[#00E5FF]">{eyebrow}</div>}
      <h1 className="font-display text-[32px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white">{title}</h1>
      {children}
    </div>
  );
}

const inputClass =
  "h-14 w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-lg font-medium text-white placeholder:text-slate-500 outline-none transition-all duration-200 focus:border-[#22C3DC] focus:bg-white/[0.07] focus:shadow-[0_0_20px_rgba(34,195,220,0.25)] aria-invalid:border-rose-500 aria-invalid:shadow-[0_0_20px_rgba(244,63,94,0.25)]";

export function Field({
  id,
  label,
  hint,
  error,
  ...input
}: ComponentProps<"input"> & { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold text-slate-200">
        {label}
      </label>
      <input id={id} aria-invalid={error ? true : undefined} className={inputClass} {...input} />
      {error ? (
        <span className="text-[13px] font-semibold text-rose-400">{error}</span>
      ) : (
        hint && <span className="text-[13px] text-slate-400">{hint}</span>
      )}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: ReactNode;
  options: { value: T; label: ReactNode }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[14px] font-semibold text-slate-200">{label}</span>
      <div
        className="grid gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] p-1.5 backdrop-blur-md"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={String(o.value)}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`h-12 rounded-xl text-[15px] transition-all duration-200 ${
                on
                  ? "bg-gradient-to-r from-finora-600 to-[#D90F81] font-bold text-white shadow-[0_0_18px_rgba(217,15,129,0.35)]"
                  : "font-semibold text-slate-400 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Check({ children, ...input }: ComponentProps<"input"> & { children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-[1.45] text-slate-300 transition-colors hover:text-white">
      <input type="checkbox" className="size-5 flex-none rounded accent-finora-600" {...input} />
      <span>{children}</span>
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200">
      <CircleAlert size={18} className="mt-px flex-none text-rose-400" />
      <span>{children}</span>
    </div>
  );
}

export const primaryButton =
  "flex h-14.5 w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-finora-600 via-finora-500 to-[#00E5FF] text-lg font-bold text-white shadow-[0_4px_25px_rgba(34,195,220,0.35)] transition-all duration-200 hover:shadow-[0_4px_30px_rgba(34,195,220,0.55)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#00E5FF]";

export const secondaryButton =
  "flex h-14 w-full items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] text-base font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] hover:border-white/30";

// Rodapé fixo com a ação principal.
export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 flex flex-col gap-2.5 border-t border-white/10 bg-[#070B16]/95 px-5 pt-3.5 pb-6 backdrop-blur-xl shadow-[0_-10px_30px_rgba(0,0,0,0.7)]">
      {children}
    </div>
  );
}

// Cabeçalho das páginas do admin no tema Papel (mesmo título do Dashboard).
export function AdminHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#00E5FF]">{eyebrow}</span>}
        <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] text-white">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

// Classes comuns das telas do admin.
export const adminMain = "adminMain adminPaper flex flex-col gap-5 bg-paper text-text";

const modalBox =
  "max-h-[calc(100dvh-48px)] overflow-y-auto rounded-3xl border border-white/15 bg-[#090E1A]/95 p-6 text-white shadow-2xl backdrop-blur-2xl max-md:max-h-[calc(100svh-20px)] max-md:w-full max-md:rounded-[20px] max-md:p-4";
const statusCard =
  "[&_span]:block [&_span]:text-xs [&_span]:text-slate-400 [&_small]:block [&_small]:text-xs [&_small]:text-slate-400 [&_strong]:my-1 [&_strong]:block [&_strong]:text-white";

export const ui = {
  card: "rounded-2xl border border-white/10 bg-[#0E1628]/80 backdrop-blur-xl shadow-xl shadow-black/20",
  eyebrow: "text-xs font-bold uppercase tracking-[0.12em] text-[#00E5FF]",
  input:
    "h-11 w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-[#22C3DC] focus:bg-white/[0.07] focus:shadow-[0_0_15px_rgba(34,195,220,0.25)]",
  pill: "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-all hover:bg-white/[0.08] hover:text-white hover:border-white/30 disabled:opacity-40",
  primary:
    "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-finora-600 to-[#00E5FF] px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,195,220,0.3)] transition-all hover:brightness-110 hover:shadow-[0_0_25px_rgba(34,195,220,0.45)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  error: "mt-3.5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-3 text-sm font-semibold text-rose-200",
  success: "mt-3.5 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-3 text-sm font-semibold text-emerald-200",
  modalBackdrop: "fixed inset-0 z-[9999] grid place-items-center bg-black/80 p-6 backdrop-blur-md max-md:items-end max-md:p-2.5",
  modal: `w-[min(620px,100%)] ${modalBox}`,
  modalMd: `w-[min(570px,100%)] ${modalBox}`,
  modalLg: `w-[min(720px,100%)] ${modalBox}`,
  modalHeader:
    "flex justify-between gap-5 border-b border-white/10 pb-4 [&_h2]:mt-1 [&_h2]:mb-1.5 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-1 [&_h3]:font-display [&_h3]:text-[22px] [&_h3]:font-bold [&_h3]:text-white [&_p]:max-w-[430px] [&_p]:text-sm [&_p]:text-slate-400",
  modalFooter:
    "mt-5 flex justify-end gap-2.5 border-t border-white/10 pt-4 max-md:sticky max-md:bottom-0 max-md:-mx-4 max-md:-mb-4 max-md:bg-[#090E1A] max-md:px-4 max-md:pb-4",
  modalClose: "grid size-9 flex-none place-items-center rounded-full border border-white/15 text-slate-400 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white",
  field:
    "mt-4 [&>label]:mb-2 [&>label]:block [&>label]:text-sm [&>label]:font-semibold [&>label]:text-slate-300 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-white/15 [&_textarea]:bg-white/[0.04] [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:text-white [&_textarea]:placeholder:text-slate-500 [&_textarea]:outline-none [&_textarea]:focus:border-[#22C3DC] [&_textarea]:focus:shadow-[0_0_15px_rgba(34,195,220,0.25)]",
  notice: `mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 ${statusCard}`,
  noticeIcon: "grid size-10 flex-none place-items-center rounded-xl border border-[#00E5FF]/30 bg-[#00E5FF]/15 text-[#00E5FF]",
  statusCard,
};

