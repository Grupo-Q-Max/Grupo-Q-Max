import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getEvents } from "@/lib/api";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import EventCreateControl from "@/components/admin/EventCreateControl";
import { FinoraLogo, QmaxBrandLogo, eventStyle, eventThemeOf } from "@/components/brand/Brand";
import type { EventRecord } from "@/lib/event-route";
import { EVENT_STATUS_LABEL, listableEvents } from "@/lib/event-status";

export default async function AdminEventSelector() {
  const events = listableEvents<EventRecord>(await getEvents());

  return (
    <main
      style={{ background: "#050811", color: "#F8FAFC", minHeight: "100vh" }}
      className="relative flex min-h-dvh flex-col gap-12 bg-ink-950 px-6 py-12 text-ink-text sm:px-16 overflow-hidden"
    >
      {/* Glow institucional */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(217,15,129,0.12),transparent_70%)] blur-3xl"
      />

      <header className="relative z-10 flex items-center justify-between border-b border-ink-line/60 pb-6">
        <div className="flex items-center gap-3">
          <QmaxBrandLogo height={28} />
          <span className="h-5 w-px bg-ink-line" />
          <FinoraLogo height={24} />
          <span className="h-5 w-px bg-ink-line" />
          <span className="font-mono text-xs tracking-wider text-ink-text-2 uppercase">Gestão de Eventos</span>
        </div>
        <div className="flex items-center gap-4">
          <EventCreateControl />
          <div className="w-28">
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <div className="relative z-10 flex flex-col gap-3">
        <span className="font-mono text-xs tracking-wider uppercase text-ink-text-2">
          PAINEL ADMINISTRATIVO
        </span>
        <h1 className="font-display text-[clamp(40px,5vw,64px)] leading-none font-extrabold tracking-[-0.04em]">
          Qual evento gerenciar?
        </h1>
      </div>

      {events.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center p-12 rounded-card border border-ink-line bg-ink-900/60 text-center gap-4">
          <p className="text-ink-text-2 text-base">Nenhum evento ativo cadastrado no momento.</p>
          <EventCreateControl />
        </div>
      ) : (

      <div className="relative z-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {events.map((c) => (
          <Link
            key={c.id}
            data-event={c.slug}
            style={eventStyle(eventThemeOf(c))}
            href={`/admin/dashboard?event=${c.id}`}
            className="group relative flex flex-col justify-between gap-6 overflow-hidden rounded-card border border-ink-line/80 bg-ink-900/90 p-8 transition-all duration-200 hover:border-accent hover:shadow-[0_16px_50px_rgba(0,0,0,0.5)]"
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-accent shadow-[0_0_12px_var(--event-accent)]" />
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs tracking-wider font-semibold uppercase text-accent">
                  {c.experience === "COFRE" ? "COFRE VIP" : "ROLETA"}
                </span>
                <span className="rounded-full bg-ink-800 px-3 py-1 text-xs font-bold text-[#C7D0DF]">
                  {EVENT_STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <h2 className="font-display text-4xl font-extrabold tracking-[-0.03em] text-white group-hover:text-accent transition-colors">
                {c.name}
              </h2>
              <p className="text-sm leading-relaxed text-ink-text-2">
                {c.experience === "COFRE"
                  ? "Cofre premiado, agendamentos comerciais VIP e disparos no WhatsApp."
                  : "Roleta interativa, entrega de brindes no balcão e regras antifraude."}
              </p>
            </div>
            <span className="mt-2 inline-flex items-center gap-2 font-bold text-accent text-sm group-hover:translate-x-1 transition-transform">
              Abrir dashboard <ArrowRight size={16} />
            </span>
          </Link>
        ))}
        </div>
      )}
    </main>
  );
}
