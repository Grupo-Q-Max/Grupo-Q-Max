import Link from "next/link";
import {
  ExternalLink,
  MessageSquare,
  Gift,
  AlertTriangle,
  ShieldAlert,
  History,
  TrendingUp,
  CheckCircle2,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import NextPrizeControl from "@/components/admin/NextPrizeControl";
import DashboardLiveIndicator from "@/components/admin/DashboardLiveIndicator";
import { RARITY, getPrizeRarity, type Rarity } from "@/components/stage/rarity";

import { getEventDashboard, getEvents } from "@/lib/api";
import { eventStyle, eventThemeOf } from "@/components/brand/Brand";

type PrizeDistribution = {
  prizeId: number;
  name: string;
  configuredProbability: number;
  delivered: number;
  actualPercent: number;
  initialStock: number;
  availableStock: number;
  stockDifference?: number;
  isLowStock?: boolean;
  isVip?: boolean;
  active: boolean;
};

type QueueItem = {
  queueId: number;
  position: number;
  prizeId: number;
  name: string;
  imageUrl: string | null;
  availableStock: number;
  probability: number;
};

type Winner = {
  drawId: number;
  drawnAt: string;
  source: string;
  prize: { id: number; name: string; imageUrl: string | null };
  participant: {
    id: number;
    name: string;
    cpfLastDigits: string;
    croNumber: string | null;
    croState: string | null;
    clinicName: string | null;
  };
};

type Blocked = {
  id: number;
  status: string;
  createdAt: string;
  ipAddress: string | null;
  deviceId: string | null;
  participant: {
    id: number;
    name: string;
    cpfLastDigits: string;
    phone: string;
    email: string;
    croNumber: string | null;
    croState: string | null;
  };
  reasons: Array<{ ruleType: string; previousCount: number; limit: number; reason: string }>;
};

// Cores de raridade otimizadas para alto contraste no tema Dark Obsidian
const RARITY_INK: Record<Rarity, string> = {
  LEGENDARY: "#FFA24C",
  EPIC: "#C084FC",
  RARE: "#38BDF8",
  COMMON: "#94A3B8",
};

const RARITY_BG: Record<Rarity, string> = {
  LEGENDARY: "rgba(255, 162, 76, 0.15)",
  EPIC: "rgba(192, 132, 252, 0.15)",
  RARE: "rgba(56, 189, 248, 0.15)",
  COMMON: "rgba(148, 163, 184, 0.12)",
};

function RarityStars({ name, label = false }: { name: string; label?: boolean }) {
  const rarity = getPrizeRarity(name);
  const r = RARITY[rarity];
  if (!r.stars && !label) return null;
  return (
    <span
      className="inline-flex items-center gap-1 font-bold"
      style={{ color: RARITY_INK[rarity] }}
    >
      <span>{r.stars}</span>
      {label && <span>{r.label}</span>}
    </span>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

type AdminPageProps = {
  searchParams: Promise<{ event?: string }>;
};

const card = "glass-card rounded-2xl border border-white/10 bg-[#0E1628]/80 backdrop-blur-xl shadow-xl shadow-black/20";
const th = "border-b border-white/10 px-3.5 py-3 font-semibold text-xs tracking-wider uppercase text-slate-400";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = await searchParams;
  const events = await getEvents();

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Nenhum evento cadastrado.");
  }

  const requestedEventId = Number(params.event);
  const eventId = events.some((event: { id: number }) => event.id === requestedEventId) ? requestedEventId : events[0].id;

  const dashboard = await getEventDashboard(eventId);
  const summary = dashboard.summary;
  const distributions = dashboard.distribution as PrizeDistribution[];
  const queue = dashboard.queue as QueueItem[];
  const winners = dashboard.latestWinners as Winner[];
  const blocked = dashboard.latestBlocked as Blocked[];

  const eventSlug = dashboard.event.slug;
  const lowStock = distributions.filter((d) => d.isLowStock);

  const kpis = [
    {
      label: "Participantes únicos",
      value: summary.uniqueParticipants,
      icon: Users,
      color: "text-[#00E5FF]",
      border: "hover:border-[#00E5FF]/40",
      glow: "from-[#00E5FF]/10",
    },
    {
      label: "Participações",
      value: summary.totalParticipations,
      icon: TrendingUp,
      color: "text-[#38BDF8]",
      border: "hover:border-[#38BDF8]/40",
      glow: "from-[#38BDF8]/10",
    },
    {
      label: "Aprovadas",
      value: summary.approved,
      icon: CheckCircle2,
      color: "text-emerald-400",
      border: "hover:border-emerald-500/40",
      glow: "from-emerald-500/10",
    },
    {
      label: "Bloqueadas",
      value: summary.blocked,
      icon: ShieldAlert,
      color: "text-rose-400",
      border: "hover:border-rose-500/40",
      glow: "from-rose-500/10",
      danger: true,
    },
    {
      label: "Prêmios entregues",
      value: summary.deliveredPrizes,
      icon: Gift,
      color: "text-amber-400",
      border: "hover:border-amber-500/40",
      glow: "from-amber-500/10",
    },
    {
      label: "Estoque disponível",
      value: summary.totalAvailableStock,
      icon: Layers,
      color: "text-[#C084FC]",
      border: "hover:border-[#C084FC]/40",
      glow: "from-[#C084FC]/10",
    },
    ...(summary.vipCodesTotal
      ? [
          {
            label: "Códigos VIP usados",
            value: `${summary.vipCodesUsed} / ${summary.vipCodesTotal}`,
            icon: Sparkles,
            color: "text-[#D90F81]",
            border: "hover:border-[#D90F81]/40",
            glow: "from-[#D90F81]/10",
          },
        ]
      : []),
  ];

  const outOfStock = distributions.filter((d) => d.active && d.availableStock === 0);
  const diverging = distributions.filter((d) => d.stockDifference);

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main
        className="adminMain adminPaper flex flex-col gap-6 bg-paper px-8 pt-6 pb-12 text-text max-sm:px-4"
        data-event={eventSlug}
        style={eventStyle(eventThemeOf(dashboard.event))}
      >
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-display text-[30px] font-extrabold tracking-[-0.03em] text-white">Dashboard</h1>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Centro de Comando & Live Ops</p>
            </div>
            <div className="rounded-xl">
              <EventSelector events={events} currentEventId={dashboard.event.id} />
            </div>
            <DashboardLiveIndicator eventId={eventId} />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={`/finora-experience/${eventSlug}/telao`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              <span>Abrir telão</span>
              <ExternalLink size={14} className="text-slate-400" />
            </a>
            <Link
              href="/admin/comunicacao"
              className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-sm font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              <MessageSquare size={14} className="text-slate-400" />
              <span>Novo disparo</span>
            </Link>
            <Link
              href="/admin/balcao"
              className="flex h-10 items-center gap-2 rounded-full bg-gradient-to-r from-finora-600 to-[#00E5FF] px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(34,195,220,0.3)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Gift size={16} />
              <span>Balcão de entrega</span>
            </Link>
          </div>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <div
                key={k.label}
                className={`relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0E1628]/80 p-4.5 backdrop-blur-xl transition-all duration-300 hover:bg-[#0E1628] ${k.border}`}
              >
                <div
                  className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${k.glow} to-transparent blur-2xl`}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">{k.label}</span>
                  <div className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                    <Icon size={14} className={k.color} />
                  </div>
                </div>
                <strong className={`font-display text-[32px] font-extrabold tracking-[-0.03em] text-white ${k.danger ? "!text-rose-400" : ""}`}>
                  {k.value}
                </strong>
              </div>
            );
          })}
        </div>

        {/* Next Prize & Stock / Antifraud Split */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] items-start gap-6">
          {/* Next Prize & Queue Table */}
          <section className={`${card} flex flex-col gap-4 p-6`}>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Próximo prêmio</h2>
                {dashboard.nextPrize ? (
                  <p className="text-sm font-medium text-slate-400">
                    Ativo na fila: <strong className="text-white">{dashboard.nextPrize.name}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Sorteio estocástico configurado</p>
                )}
              </div>
              <NextPrizeControl eventId={dashboard.event.id} currentPrize={dashboard.nextPrize} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className={th}>#</th>
                    <th className={th}>Prêmio na fila</th>
                    <th className={th}>Estoque</th>
                    <th className={th}>Chance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                        Fila vazia: a roleta sorteia automaticamente pelas probabilidades cadastradas.
                      </td>
                    </tr>
                  ) : (
                    queue.slice(0, 6).map((item) => (
                      <tr key={item.queueId} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-3.5 py-3 font-mono text-xs font-bold text-slate-400">{item.position}</td>
                        <td className="px-3.5 py-3 font-medium text-white">
                          <RarityStars name={item.name} /> {item.name}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-sm text-slate-300">{item.availableStock}</td>
                        <td className="px-3.5 py-3 font-mono text-sm font-semibold text-[#00E5FF]">{item.probability}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Link
              href="/admin/fila"
              className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-[#00E5FF] transition-colors hover:text-white"
            >
              <span>Gerenciar fila completa de premiação</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </section>

          {/* Stock & Blocked Column */}
          <div className="flex flex-col gap-6">
            {/* Stock Progress Monitor */}
            <section className={`${card} flex flex-col gap-4 p-6`}>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-4">
                <h2 className="text-lg font-bold text-white">Estoque em Tempo Real</h2>
                {lowStock.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                    <AlertTriangle size={13} />
                    <span>Baixo: {lowStock.length} itens</span>
                  </span>
                )}
              </div>

              {outOfStock.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-200">
                  <ShieldAlert size={16} className="text-rose-400" />
                  <span>Esgotado (ativo): {outOfStock.map((d) => d.name).join(", ")}</span>
                </div>
              )}

              {diverging.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
                  <strong className="font-bold text-white">Estoque diverge do histórico:</strong>{" "}
                  {diverging.map((d) => `${d.name} (${(d.stockDifference ?? 0) > 0 ? "+" : ""}${d.stockDifference})`).join(", ")}
                </div>
              )}

              {distributions.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum prêmio cadastrado.</p>
              ) : (
                <div className="flex flex-col gap-3.5">
                  {distributions.map((d) => {
                    const pct = d.initialStock > 0 ? Math.min(100, Math.round((d.availableStock / d.initialStock) * 100)) : 0;
                    const rarity = getPrizeRarity(d.name);
                    const color = RARITY_INK[rarity];

                    return (
                      <div key={d.prizeId} className={`flex flex-col gap-1.5 ${d.active ? "" : "opacity-40"}`}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-white">
                            <RarityStars name={d.name} /> {d.name}
                            {d.isVip && (
                              <span className="ml-2 rounded-md border border-amber-500/30 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                                VIP
                              </span>
                            )}
                          </span>
                          <span
                            className={`flex-none font-mono text-sm ${
                              d.active && d.availableStock === 0
                                ? "font-bold text-rose-400"
                                : d.active && d.availableStock <= 5
                                ? "font-bold text-amber-400"
                                : "text-slate-300"
                            }`}
                          >
                            {d.availableStock} / {d.initialStock}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: color,
                              boxShadow: `0 0 10px ${color}80`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Blocked Attempts Monitor */}
            <section className={`${card} flex flex-col gap-4 p-6`}>
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-rose-400" />
                  <h2 className="text-lg font-bold text-white">Tentativas Bloqueadas</h2>
                </div>
                <Link
                  href="/admin/antifraude"
                  className="text-xs font-bold uppercase tracking-wider text-[#00E5FF] transition-colors hover:text-white"
                >
                  Ver antifraude
                </Link>
              </div>

              {blocked.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma tentativa bloqueada recente.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {blocked.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-sm transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-300">
                        {item.reasons[0]?.ruleType ?? item.status}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-slate-200">
                        {item.participant.name} · •••-{item.participant.cpfLastDigits}
                      </span>
                      <span className="font-mono text-xs text-slate-400">{formatTime(item.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Latest Winners Grid */}
        <section className={`${card} flex flex-col gap-4 p-6`}>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#FFA24C]" />
              <h2 className="text-lg font-bold text-white">Últimos Ganhadores</h2>
            </div>
            <Link
              href="/admin/historico"
              className="text-xs font-bold uppercase tracking-wider text-[#00E5FF] transition-colors hover:text-white"
            >
              Histórico Completo
            </Link>
          </div>

          {winners.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum ganhador registrado ainda.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-3">
              {winners.slice(0, 8).map((w) => {
                const rarity = getPrizeRarity(w.prize.name);
                return (
                  <div
                    key={w.drawId}
                    className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition-all hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-[14px] font-bold text-white">{w.participant.name}</strong>
                      <span className="font-mono text-[11px] text-slate-400">{formatTime(w.drawnAt)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-[13px] text-slate-300">
                      <RarityStars name={w.prize.name} label />
                      <span className="text-slate-400">·</span>
                      <span className="truncate">{w.prize.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

