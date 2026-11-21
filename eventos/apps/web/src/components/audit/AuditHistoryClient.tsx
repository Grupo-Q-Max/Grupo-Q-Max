"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Gift,
  History,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Wifi,
} from "lucide-react";
import { fetchAdminProxy } from "@/lib/api-client";
import { useSearchParams } from "next/navigation";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type AuditLog = {
  id: string;
  event_id: number | null;
  admin_user_id: number | null;
  actor_type: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  before_data: any;
  after_data: any;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  admin_users: AdminUser | null;
};

type ParticipationLog = {
  id: number;
  status: string; // 'APPROVED' | 'BLOCKED' | 'REVIEW' | 'COMPLETED'
  device_id?: string | null;
  ip_address?: string | null;
  whatsapp_validated?: boolean;
  created_at: string;
  completed_at?: string | null;
  participants: {
    id: number;
    full_name: string;
    cpf_last_digits?: string | null;
    phone: string;
    email?: string | null;
    clinic_name?: string | null;
    city?: string | null;
    state?: string | null;
  };
  draws?: {
    id: number;
    source: string;
    drawn_at: string;
    prizes?: {
      id: number;
      name: string;
    } | null;
  } | null;
  fraud_checks?: any[];
};

type UnifiedActivity = {
  id: string;
  timestamp: string;
  category: "REGISTER" | "DRAW" | "CLAIM" | "ADMIN" | "BLOCK";
  title: string;
  subtitle: string;
  personName?: string;
  phone?: string;
  pin?: string;
  clinic?: string;
  prizeName?: string;
  drawSource?: string;
  actorName?: string;
  statusTag?: string;
  rawDetails?: any;
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatShortTime(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

export default function AuditHistoryClient() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [participations, setParticipations] = useState<ParticipationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "ALL" | "REGISTER" | "DRAW" | "CLAIM" | "ADMIN" | "BLOCK"
  >("ALL");

  const searchParams = useSearchParams();
  const currentEventId = searchParams.get("event") || searchParams.get("eventId") || "1";

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const auditRes = await fetchAdminProxy(`/audit?eventId=${currentEventId}`);
      const auditData = auditRes.ok ? await auditRes.json() : [];

      const partRes = await fetchAdminProxy(`/participations?eventId=${currentEventId}`);
      const partData = partRes.ok ? await partRes.json() : [];

      setAuditLogs(Array.isArray(auditData) ? auditData : []);
      setParticipations(Array.isArray(partData) ? partData : []);
    } catch (err: any) {
      setError(err.message || "Falha ao carregar o histórico de atividades.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentEventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const unifiedActivities = useMemo<UnifiedActivity[]>(() => {
    const list: UnifiedActivity[] = [];

    participations.forEach((p) => {
      const pin = `#${String(p.id).padStart(4, "0")}`;
      const name = p.participants?.full_name || "Visitante";
      const clinic = p.participants?.clinic_name || "Clínica não informada";

      list.push({
        id: `part-reg-${p.id}`,
        timestamp: p.created_at,
        category: p.status === "BLOCKED" ? "BLOCK" : "REGISTER",
        title: p.status === "BLOCKED" ? `Cadastro Bloqueado: ${name}` : `Novo Cadastro: ${name}`,
        subtitle: `${clinic} • Tel: ${p.participants?.phone || "N/A"}`,
        personName: name,
        phone: p.participants?.phone,
        pin,
        clinic,
        statusTag: p.status,
        rawDetails: p,
      });

      if (p.draws) {
        const prizeName = p.draws.prizes?.name || "Brinde Finora";
        const sourceLabel = p.draws.source === "GRAND_DRAW" ? "Sorteio Geral" : "Roleta do Totem";

        list.push({
          id: `part-draw-${p.draws.id}`,
          timestamp: p.draws.drawn_at || p.created_at,
          category: "DRAW",
          title: `${name} ganhou: ${prizeName}`,
          subtitle: `Conquistado no ${sourceLabel} • PIN ${pin}`,
          personName: name,
          phone: p.participants?.phone,
          pin,
          prizeName,
          drawSource: sourceLabel,
          statusTag: p.status === "COMPLETED" ? "ENTREGUE" : "PENDENTE",
          rawDetails: p.draws,
        });
      }

      if (p.status === "COMPLETED" && p.completed_at) {
        list.push({
          id: `part-claim-${p.id}`,
          timestamp: p.completed_at,
          category: "CLAIM",
          title: `Brinde Entregue no Balcão: ${name}`,
          subtitle: `Prêmio ${p.draws?.prizes?.name || "Brinde"} baixado com sucesso via PIN ${pin}`,
          personName: name,
          pin,
          prizeName: p.draws?.prizes?.name,
          statusTag: "ENTREGUE",
          rawDetails: p,
        });
      }
    });

    auditLogs.forEach((log) => {
      if (log.action === "PARTICIPANT_REGISTERED" && log.actor_type === "PARTICIPANT") {
        return;
      }

      const rawDesc = (log.description || "").toLowerCase();
      if (
        rawDesc.includes("sorteio concluído. teste ") ||
        rawDesc.includes("sorteio concluído. teste.") ||
        rawDesc.includes("participante teste ") ||
        rawDesc.includes("rodrigo dante")
      ) {
        return;
      }

      const actorName = log.admin_users?.name || (log.actor_type === "ADMIN" ? "Administrador" : log.actor_type);

      let actionDesc = log.description || log.action;
      if (log.action === "GRAND_DRAW_EXECUTED") actionDesc = "Sorteio Geral Disparado";
      if (log.action === "PRIZE_ADDED") actionDesc = "Prêmio Editado/Adicionado ao Estoque";
      if (log.action === "FRAUD_RULE_UPDATED") actionDesc = "Regra de Segurança Atualizada";

      list.push({
        id: `audit-${log.id}`,
        timestamp: log.created_at,
        category: "ADMIN",
        title: `Ação no Sistema: ${actionDesc}`,
        subtitle: `Realizado por ${actorName} • IP ${log.ip_address || "N/A"}`,
        actorName,
        rawDetails: log,
      });
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [participations, auditLogs]);

  const filteredActivities = useMemo(() => {
    return unifiedActivities.filter((act) => {
      if (categoryFilter !== "ALL" && act.category !== categoryFilter) return false;
      if (!search.trim()) return true;

      const q = search.toLowerCase();
      return (
        act.title.toLowerCase().includes(q) ||
        act.subtitle.toLowerCase().includes(q) ||
        (act.pin && act.pin.toLowerCase().includes(q))
      );
    });
  }, [unifiedActivities, categoryFilter, search]);

  const totalParticipations = participations.length;
  const totalClaims = participations.filter((p) => p.status === "COMPLETED").length;
  const totalAdminActions = auditLogs.length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 space-y-6 bg-paper font-sans selection:bg-cyan-500/15 h-screen max-w-6xl mx-auto w-full">

      {/* Cabeçalho Premium */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-line relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-3">
            <History size={14} />
            Relatórios
          </div>
          <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mb-2">
            Histórico e Auditoria
          </h1>
          <p className="text-text-2 text-sm max-w-2xl">
            Acompanhe em tempo real cada cadastro, prêmio e ação administrativa realizada na plataforma.
          </p>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold text-text bg-surface border border-line-strong hover:bg-line-strong hover:text-text transition-all group disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-finora-600" : "text-text-2 group-hover:text-finora-600"} />
          <span>{refreshing ? "Atualizando..." : "Sincronizar"}</span>
        </button>
      </header>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-bold flex items-center gap-3 relative z-10">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}

      {/* Cards de Métricas Premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        <div className="bg-surface border border-line p-5 rounded-2xl flex items-center gap-4 hover:border-cyan-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <UserPlus size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-text-2 uppercase tracking-widest block mb-0.5">
              Cadastros Totais
            </span>
            <strong className="text-2xl font-black text-text block">
              {totalParticipations}
            </strong>
          </div>
        </div>

        <div className="bg-surface border border-line p-5 rounded-2xl flex items-center gap-4 hover:border-emerald-500/30 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <PackageCheck size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-text-2 uppercase tracking-widest block mb-0.5">
              Entregues no Balcão
            </span>
            <strong className="text-2xl font-black text-text block">
              {totalClaims}
            </strong>
          </div>
        </div>

        <div className="bg-surface border border-line p-5 rounded-2xl flex items-center gap-4 hover:border-cyan-500/40 transition-colors">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Settings size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black text-text-2 uppercase tracking-widest block mb-0.5">
              Ações Admin
            </span>
            <strong className="text-2xl font-black text-text block">
              {totalAdminActions}
            </strong>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Abas */}
      <div className="bg-surface border border-line p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {[
            { id: "ALL", label: "Tudo", count: unifiedActivities.length },
            { id: "REGISTER", label: "Cadastros", count: unifiedActivities.filter((a) => a.category === "REGISTER").length },
            { id: "DRAW", label: "Prêmios Ganhos", count: unifiedActivities.filter((a) => a.category === "DRAW").length },
            { id: "CLAIM", label: "Entregas Balcão", count: unifiedActivities.filter((a) => a.category === "CLAIM").length },
            { id: "ADMIN", label: "Ações Admin", count: unifiedActivities.filter((a) => a.category === "ADMIN").length },
            { id: "BLOCK", label: "Bloqueios", count: unifiedActivities.filter((a) => a.category === "BLOCK").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id as any)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                categoryFilter === tab.id
                  ? "bg-finora-600 text-white border border-cyan-500/30"
                  : "bg-paper text-text-2 hover:text-text border border-line hover:border-line-strong hover:bg-line-strong"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${categoryFilter === tab.id ? "bg-surface text-text" : "bg-surface text-text-2"}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, PIN, prêmio..."
            className="w-full bg-surface border border-line rounded-xl pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-[#8792A3] focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 transition-colors"
          />
        </div>
      </div>

      {/* Lista de Histórico Premium */}
      <div className="bg-surface border border-line p-2 sm:p-6 rounded-3xl relative z-10 min-h-[400px]">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-text-2">
            <RefreshCw size={32} className="animate-spin text-finora-600" />
            <span className="text-sm font-medium">Buscando auditoria do sistema...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-text-2">
            <History size={48} className="text-text-2" />
            <span className="text-sm font-medium">Nenhum registro encontrado.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((act) => {
              let icon = UserPlus;
              let badgeStyle = "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
              let iconBg = "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";

              if (act.category === "DRAW") {
                icon = Gift;
                badgeStyle = "bg-[#FFF3DC] text-[#8A4B00] border-[#F2D19B]";
                iconBg = "bg-[#FFF3DC] text-[#8A4B00] border-[#F2D19B]";
              } else if (act.category === "CLAIM") {
                icon = PackageCheck;
                badgeStyle = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                iconBg = "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
              } else if (act.category === "ADMIN") {
                icon = Settings;
                badgeStyle = "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
                iconBg = "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
              } else if (act.category === "BLOCK") {
                icon = ShieldAlert;
                badgeStyle = "bg-rose-500/15 text-rose-400 border-rose-500/30";
                iconBg = "bg-rose-500/15 text-rose-400 border-rose-500/30";
              }

              const IconComp = icon;

              return (
                <article
                  key={act.id}
                  className="bg-paper border border-line p-5 rounded-2xl hover:border-cyan-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${iconBg}`}>
                      <IconComp size={22} strokeWidth={2.5} />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded border ${badgeStyle}`}>
                          {act.category === "REGISTER" && "CADASTRO"}
                          {act.category === "DRAW" && "PRÊMIO GANHO"}
                          {act.category === "CLAIM" && "ENTREGUE (BALCÃO)"}
                          {act.category === "ADMIN" && "AÇÃO ADMIN"}
                          {act.category === "BLOCK" && "BLOQUEIO / ALERTA"}
                        </span>

                        {act.pin && (
                          <span className="text-[10px] font-mono font-black text-[#8A4B00] bg-[#FFF3DC] border border-[#F2D19B] px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Sparkles size={10} /> {act.pin}
                          </span>
                        )}
                      </div>

                      <strong className="text-base font-bold text-text block leading-tight">
                        {act.title}
                      </strong>

                      <p className="text-sm text-text-2 mt-1">
                        {act.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-line text-text-2 self-start md:self-center shrink-0 font-mono text-[11px] group-hover:text-text transition-colors">
                    <Clock size={12} className="text-finora-600" />
                    <span>{formatDate(act.timestamp)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
