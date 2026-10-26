import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { FinoraLogo, QmaxBrandLogo, eventStyle, eventThemeOf } from "@/components/brand/Brand";
import { getEvents } from "@/lib/api";
import type { EventRecord } from "@/lib/event-route";
import { EVENT_STATUS_LABEL, listableEvents } from "@/lib/event-status";

const ghost =
  "inline-flex h-12 items-center rounded-full border border-ink-line bg-ink-900/60 px-5 text-sm font-semibold text-ink-text transition-all duration-180 hover:border-accent hover:text-white hover:bg-ink-800";

export default async function Home() {
  const events = listableEvents<EventRecord>(await getEvents().catch(() => []));

  return (
    <main className="relative min-h-dvh flex flex-col gap-12 bg-ink-950 px-6 py-10 text-ink-text sm:px-16 overflow-hidden">
      {/* Ambient glow inspirado no ecossistema Grupo Q-Max */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,15,129,0.14),transparent_65%)] blur-3xl"
      />

      <header className="relative z-10 flex items-center justify-between border-b border-ink-line/60 pb-6">
        <div className="flex items-center gap-3">
          <QmaxBrandLogo height={28} />
          <span className="h-5 w-px bg-ink-line" />
          <FinoraLogo height={24} />
          <span className="h-5 w-px bg-ink-line" />
          <span className="font-mono text-xs tracking-wider text-ink-text-2 uppercase">Finora Experience</span>
        </div>
        <Link
          href="/admin"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 text-sm font-semibold transition-all duration-180 hover:border-[#d90f81] hover:bg-white/10 hover:shadow-[0_0_20px_rgba(217,15,129,0.25)]"
        >
          Painel Administrativo
        </Link>
      </header>

      <div className="relative z-10 flex max-w-[820px] flex-col gap-3">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-ink-line bg-ink-900/80 px-3.5 py-1 text-xs font-mono tracking-wider text-ink-text-2">
          <span className="size-2 rounded-full bg-[#d90f81] animate-pulse" />
          ECOSSISTEMA GRUPO Q-MAX · ATIVAÇÕES AO VIVO
        </div>
        <h1 className="font-display text-[clamp(44px,5.5vw,72px)] font-extrabold leading-none tracking-[-0.04em]">
          Escolha o evento
        </h1>
        <p className="text-xl text-[#A7B2C6] max-w-[680px]">
          Selecione a experiência interativa para abrir o totem do estande, o telão oficial da TV ou o dashboard de operação.
        </p>
      </div>

      <div className="relative z-10 grid flex-1 grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => {
          const active = event.status === "ACTIVE";
          const isCofre = event.experience === "COFRE";
          return (
            <section
              key={event.id}
              data-event={event.slug}
              style={eventStyle(eventThemeOf(event))}
              className={`group relative flex flex-col justify-between gap-6 overflow-hidden rounded-card border transition-all duration-200 p-8 ${
                active
                  ? "border-ink-line/80 bg-ink-900/90 shadow-[0_12px_40px_rgba(0,0,0,0.4)] hover:border-accent hover:shadow-[0_16px_50px_rgba(0,0,0,0.6)]"
                  : "border-ink-line/40 bg-ink-950/60 opacity-80"
              }`}
            >
              {/* Barra superior de destaque na cor do evento */}
              <div
                className={`absolute inset-x-0 top-0 h-1.5 bg-accent transition-opacity ${
                  active ? "opacity-100 shadow-[0_0_12px_var(--event-accent)]" : "opacity-40"
                }`}
              />

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs tracking-wider uppercase font-semibold text-accent">
                    {isCofre ? "COFRE VIP" : "ROLETA DA SORTE"}
                  </span>
                  {active ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#123A24] px-3 py-1 text-xs font-bold text-[#7BE3A0] border border-[#1b5e39]">
                      <span className="size-2 rounded-full bg-[#4ADE80] animate-pulse" />
                      Ativo
                    </span>
                  ) : (
                    <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-bold text-[#C7D0DF]">
                      {EVENT_STATUS_LABEL[event.status] ?? event.status}
                    </span>
                  )}
                </div>

                <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] leading-tight text-white group-hover:text-accent transition-colors">
                  {event.name}
                </h2>
                <p className="text-sm leading-relaxed text-ink-text-2">
                  {isCofre
                    ? "Experiência do cofre digital com código secreto e agendamento comercial VIP."
                    : "Roleta interativa da sorte com leitura de QR Code e entrega no balcão."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-4 border-t border-ink-line/50">
                {active ? (
                  <Link
                    href={`/${event.slug}`}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-ink-950 shadow-md transition-all duration-180 hover:brightness-110 active:scale-[0.98]"
                  >
                    Abrir estande <ArrowRight size={16} strokeWidth={2.4} />
                  </Link>
                ) : (
                  <Link
                    href={`/admin/relatorios?event=${event.id}`}
                    className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-accent px-5 text-sm font-bold text-accent hover:bg-accent/10"
                  >
                    Ver relatório
                  </Link>
                )}
                <Link href={`/${event.slug}/telao`} className={ghost}>
                  Telão
                </Link>
                <Link href={`/admin/dashboard?event=${event.id}`} className={ghost}>
                  Painel
                </Link>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
