"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  LoaderCircle,
  CalendarClock,
  UserCheck,
  UserX,
  Phone,
  Mail,
  Building2,
  UserRound,
  MessageSquare,
  Video,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
  Calendar,
  Clock,
  Search,
  Trash2,
  Crown,
  Gift,
  X,
} from "lucide-react";
import { getAdminProxyUrl, fetchApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { addMinutes, format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaMeeting = {
  id: number | string;
  msEventId?: string;
  source?: "FINORA" | "MICROSOFT_365";
  isMicrosoft?: boolean;
  scheduled_at: string;
  end_at?: string;
  status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  subject?: string;
  location?: string;
  teamsUrl?: string;
  webLink?: string;
  organizerName?: string;
  organizerEmail?: string;
  msResponse?: string;
  msShowAs?: string;
  hostKey?: "hugo" | "ale";
  hostName?: string;
  hostEmail?: string;
  vipPrize?: {
    drawId: number;
    prizeId: number;
    name: string;
    description?: string | null;
    drawnAt?: string | null;
    claimedAt?: string | null;
  } | null;
  normalPrize?: {
    drawId: number;
    prizeId: number;
    name: string;
    description?: string | null;
    drawnAt?: string | null;
    claimedAt?: string | null;
  } | null;
  participants: {
    id: number;
    full_name: string;
    cpf?: string;
    cpf_formatted?: string;
    phone: string;
    email: string;
    clinic_name: string;
    cro_number: string | null;
    cro_state: string | null;
    chairs_count: number | null;
  };
};

export default function AdminAgendaView({ eventId }: { eventId: number }) {
  const toast = useToast();
  const [meetings, setMeetings] = useState<AgendaMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterSource, setFilterSource] = useState<"ALL" | "FINORA" | "MICROSOFT">("ALL");
  const [filterHost, setFilterHost] = useState<"ALL" | "hugo" | "ale">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Estado do Modal de Reagendamento
  const [mounted, setMounted] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<AgendaMeeting | null>(null);
  const [rescheduleDateStr, setRescheduleDateStr] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lista de dias disponíveis para reagendamento (22/11/2026 até 28/02/2027)
  const availableDays = useMemo(() => {
    const list: { dateStr: string; label: string; monthKey: string; monthLabel: string }[] = [];
    const minDate = new Date(2026, 10, 22, 0, 0, 0, 0);
    const limitDate = new Date(2027, 1, 28, 23, 59, 59);
    const now = new Date();
    const cur = new Date(now.getTime() < minDate.getTime() ? minDate : now);
    cur.setHours(0, 0, 0, 0);
    while (cur <= limitDate) {
      const dStr = format(cur, "yyyy-MM-dd");
      const mKey = format(cur, "yyyy-MM");
      list.push({
        dateStr: dStr,
        label: format(cur, "EEE, dd/MM", { locale: ptBR }),
        monthKey: mKey,
        monthLabel: format(cur, "MMM 'de' yyyy", { locale: ptBR }),
      });
      cur.setDate(cur.getDate() + 1);
    }
    return list;
  }, []);

  const [selectedRescheduleMonth, setSelectedRescheduleMonth] = useState<string>("2026-11");

  const rescheduleMonths = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of availableDays) {
      if (!map.has(d.monthKey)) map.set(d.monthKey, d.monthLabel);
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [availableDays]);

  const daysInSelectedMonth = useMemo(
    () => availableDays.filter((d) => d.monthKey === selectedRescheduleMonth),
    [availableDays, selectedRescheduleMonth],
  );

  function openRescheduleModal(meeting: AgendaMeeting) {
    setRescheduleTarget(meeting);
    setRescheduleDateStr("");
    setRescheduleSlots([]);
    setRescheduleSlot(null);
    try {
      const mKey = format(new Date(meeting.scheduled_at), "yyyy-MM");
      if (rescheduleMonths.some((m) => m.key === mKey)) {
        setSelectedRescheduleMonth(mKey);
      } else if (rescheduleMonths[0]) {
        setSelectedRescheduleMonth(rescheduleMonths[0].key);
      }
    } catch {
      if (rescheduleMonths[0]) setSelectedRescheduleMonth(rescheduleMonths[0].key);
    }
  }

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDateStr) {
      setRescheduleSlots([]);
      setRescheduleSlot(null);
      return;
    }
    let cancelled = false;
    setLoadingSlots(true);
    setRescheduleSlots([]);
    setRescheduleSlot(null);

    fetchApi<string[]>(`/meetings/event/${eventId}/available-slots?date=${rescheduleDateStr}&host=hugo`)
      .then((data) => {
        if (cancelled) return;
        setRescheduleSlots(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRescheduleSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rescheduleTarget, rescheduleDateStr, eventId]);

  async function confirmReschedule() {
    if (!rescheduleTarget || !rescheduleSlot) return;
    setSavingReschedule(true);
    try {
      const proxyUrl = getAdminProxyUrl();
      const isMs = rescheduleTarget.source === "MICROSOFT_365" || (typeof rescheduleTarget.id === "string" && rescheduleTarget.id.startsWith("ms-"));
      const endpoint = isMs
        ? `${proxyUrl}/meetings/microsoft/${encodeURIComponent(String(rescheduleTarget.msEventId || rescheduleTarget.id))}/reschedule`
        : `${proxyUrl}/meetings/${rescheduleTarget.id}/reschedule`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: rescheduleSlot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Falha ao reagendar reunião");
      }
      toast.success("Reunião reagendada com sucesso no site e na agenda Microsoft do Hugo!");
      setRescheduleTarget(null);
      fetchAgenda(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reagendar a reunião.");
    } finally {
      setSavingReschedule(false);
    }
  }

  async function fetchAgenda(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const proxyUrl = getAdminProxyUrl();
      // Busca todas as reuniões até o fim de Janeiro de 2027 (sem travar em um único dia)
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/agenda?date=ALL`);
      if (!res.ok) throw new Error("Erro ao buscar agenda");
      const data = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
      if (isManual) {
        toast.success("Agenda consolidada atualizada com sucesso!");
      }
    } catch {
      toast.error("Erro ao carregar a agenda comercial.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function updateStatus(meetingId: number | string, status: "COMPLETED" | "NO_SHOW") {
    if (typeof meetingId === "string" && meetingId.startsWith("ms-")) {
      toast.error("Compromissos externos da Microsoft devem ser gerenciados pelo Outlook / Teams.");
      return;
    }

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/${meetingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");

      toast.success(
        status === "COMPLETED"
          ? "Reunião concluída com sucesso!"
          : "Visitante marcado como ausente (No-Show)."
      );
      fetchAgenda(true);
    } catch {
      toast.error("Erro ao atualizar o status da reunião.");
    }
  }

  async function deleteMeeting(meeting: AgendaMeeting | number | string) {
    const meetingId = typeof meeting === "object" ? meeting.id : meeting;
    const isMs =
      (typeof meeting === "object" && meeting.source === "MICROSOFT_365") ||
      (typeof meetingId === "string" && meetingId.startsWith("ms-"));

    if (!confirm("Tem certeza que deseja cancelar esta reunião? Isso também removerá o compromisso do calendário Microsoft Teams/Outlook do Hugo.")) {
      return;
    }

    try {
      const proxyUrl = getAdminProxyUrl();
      const targetMsId = typeof meeting === "object" ? meeting.msEventId || meeting.id : meetingId;
      const endpoint = isMs
        ? `${proxyUrl}/meetings/microsoft/${encodeURIComponent(String(targetMsId))}`
        : `${proxyUrl}/meetings/${meetingId}`;

      const res = await fetch(endpoint, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Falha ao cancelar reunião");
      }
      toast.success("Reunião cancelada com sucesso no site e na agenda Microsoft do Hugo!");
      fetchAgenda(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar a reunião.");
    }
  }

  async function deleteAllSiteMeetings() {
    if (!confirm("⚠️ ATENÇÃO: Tem certeza que deseja apagar TODAS as reuniões agendadas pelo site neste evento? Elas também serão canceladas na agenda do Teams do Hugo.")) {
      return;
    }

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/all`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Falha ao apagar reuniões do site");
      toast.success(data.message || "Todas as reuniões do site foram excluídas com sucesso!");
      fetchAgenda(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao excluir reuniões em lote.");
    }
  }

  // Estatísticas consolidadas
  const totalItems = meetings.length;
  const finoraMeetings = meetings.filter((m) => m.source !== "MICROSOFT_365");
  const microsoftMeetings = meetings.filter((m) => m.source === "MICROSOFT_365");
  const hugoMeetings = meetings.filter((m) => (m.hostKey || "hugo") === "hugo");
  const aleMeetings = meetings.filter((m) => m.hostKey === "ale" || m.hostEmail?.toLowerCase().includes("alessandra"));
  const completedCount = finoraMeetings.filter((m) => m.status === "COMPLETED").length;
  const noShowCount = finoraMeetings.filter((m) => m.status === "NO_SHOW").length;
  const waitingCount = finoraMeetings.filter((m) => m.status === "SCHEDULED").length;

  // Filtragem ativa por sócio (Hugo / Ale), fonte e busca
  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return meetings.filter((m) => {
      const mHostKey = m.hostKey || (m.hostEmail?.toLowerCase().includes("alessandra") ? "ale" : "hugo");
      if (filterHost !== "ALL" && mHostKey !== filterHost) return false;

      if (filterSource === "FINORA" && m.source === "MICROSOFT_365") return false;
      if (filterSource === "MICROSOFT" && m.source !== "MICROSOFT_365") return false;

      if (!q) return true;
      const matchName = m.participants.full_name?.toLowerCase().includes(q);
      const matchClinic = m.participants.clinic_name?.toLowerCase().includes(q);
      const matchSubject = m.subject?.toLowerCase().includes(q);
      const matchPhone = m.participants.phone?.includes(q);
      const matchHost = (m.hostName || "").toLowerCase().includes(q) || (m.hostEmail || "").toLowerCase().includes(q);
      return matchName || matchClinic || matchSubject || matchPhone || matchHost;
    });
  }, [meetings, filterHost, filterSource, searchQuery]);

  // Agrupamento por Data (separadas por dia cronologicamente)
  const groupedMeetings = useMemo(() => {
    const groups: { [dateKey: string]: AgendaMeeting[] } = {};
    for (const item of filteredMeetings) {
      if (!item.scheduled_at) continue;
      const d = new Date(item.scheduled_at);
      if (isNaN(d.getTime())) continue;
      const dateKey = d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    }

    const sortedKeys = Object.keys(groups).sort();
    return sortedKeys.map((k) => {
      const parts = k.split("-").map(Number);
      const dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
      return {
        dateKey: k,
        dateObj,
        items: groups[k].sort(
          (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        ),
      };
    });
  }, [filteredMeetings]);

  const totalDaysWithMeetings = groupedMeetings.length;

  return (
    <div className="space-y-8">
      {/* Barra de Controle de Métricas e Sincronização */}
      <div className="bg-surface border border-line p-6 rounded-3xl shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <CalendarClock size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <span>Agenda Completa até Janeiro de 2027</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs text-text-2">
                {totalItems} compromissos no total · {totalDaysWithMeetings} dias com reuniões agendadas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            {/* Campo de Busca Rápida */}
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
              <input
                type="text"
                placeholder="Buscar mentorado ou assunto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-line-strong rounded-xl pl-9 pr-3.5 py-2 text-text text-xs font-medium focus:border-finora-500 focus:bg-surface focus:ring-2 focus:ring-finora-500/20 outline-none transition-all placeholder:text-text-2"
              />
            </div>

            <Link
              href={`/admin/recompensas-vip?event=${eventId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] text-xs font-black transition-all shadow-md hover:brightness-110 shrink-0"
              title="Ver todas as recompensas VIP conquistadas por quem marcou agenda"
            >
              <Crown size={14} />
              <span>Recompensas VIP da Agenda</span>
            </Link>

            <button
              type="button"
              onClick={() => fetchAgenda(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              title="Sincronizar em tempo real com Microsoft 365"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>Sincronizar</span>
            </button>

            {finoraMeetings.length > 0 && (
              <button
                type="button"
                onClick={deleteAllSiteMeetings}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
                title="Excluir todas as reuniões agendadas pelo site neste evento"
              >
                <Trash2 size={14} />
                <span>Limpar Reuniões do Site</span>
              </button>
            )}
          </div>
        </div>

        {/* Cards de Métricas Consolidadas */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-line">
          <div className="bg-surface border border-line-strong rounded-2xl px-3.5 py-2.5 text-center">
            <span className="block text-[10px] uppercase text-text-2 font-bold tracking-wider">Total Geral</span>
            <strong className="text-xl text-text font-mono font-black">{totalItems}</strong>
          </div>
          <div className="bg-finora-500/10 border border-finora-500/30 rounded-2xl px-3.5 py-2.5 text-center">
            <span className="block text-[10px] uppercase text-finora-400 font-bold tracking-wider">Finora VIP</span>
            <strong className="text-xl text-finora-400 font-mono font-black">{waitingCount}</strong>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl px-3.5 py-2.5 text-center">
            <span className="block text-[10px] uppercase text-indigo-300 font-bold tracking-wider">Teams / Outlook</span>
            <strong className="text-xl text-indigo-300 font-mono font-black">{microsoftMeetings.length}</strong>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-3.5 py-2.5 text-center">
            <span className="block text-[10px] uppercase text-emerald-400 font-bold tracking-wider">Concluídas</span>
            <strong className="text-xl text-emerald-400 font-mono font-black">{completedCount}</strong>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-3.5 py-2.5 text-center col-span-2 sm:col-span-1">
            <span className="block text-[10px] uppercase text-rose-400 font-bold tracking-wider">Faltas (No-Show)</span>
            <strong className="text-xl text-rose-400 font-mono font-black">{noShowCount}</strong>
          </div>
        </div>

        {/* Abas de Filtro de Origem e Sócio */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterSource("ALL")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterSource === "ALL"
                    ? "bg-finora-600 text-white shadow-md"
                    : "bg-surface border border-line text-text-2 hover:text-text hover:bg-line/40"
                }`}
              >
                Todos os Compromissos ({totalItems})
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("FINORA")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterSource === "FINORA"
                    ? "bg-finora-600 text-white shadow-md"
                    : "bg-surface border border-line text-text-2 hover:text-text hover:bg-line/40"
                }`}
              >
                <Sparkles size={12} />
                <span>Consultorias Finora VIP ({finoraMeetings.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterSource("MICROSOFT")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  filterSource === "MICROSOFT"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-surface border border-line text-text-2 hover:text-text hover:bg-line/40"
                }`}
              >
                <Calendar size={12} />
                <span>Microsoft 365 ({microsoftMeetings.length})</span>
              </button>
            </div>

            <span className="text-xs text-text-2 font-medium">
              Exibindo {filteredMeetings.length} de {totalItems}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase text-text-2 mr-1">Agenda:</span>
            <button
              type="button"
              onClick={() => setFilterHost("ALL")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "ALL"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              Todas as Agendas ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setFilterHost("hugo")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "hugo"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              🤵 Agenda Hugo ({hugoMeetings.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterHost("ale")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "ale"
                  ? "bg-fuchsia-500 text-white shadow-sm"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              👩‍💼 Agenda Ale ({aleMeetings.length})
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal Agrupado por Data */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-line rounded-3xl">
          <LoaderCircle size={40} className="animate-spin text-finora-600 mb-4" />
          <span className="text-text font-bold text-sm">Carregando todas as reuniões e agenda executiva do Hugo...</span>
          <span className="text-text-2 text-xs mt-1">Sincronizando Microsoft Graph API em tempo real até Janeiro</span>
        </div>
      ) : groupedMeetings.length === 0 ? (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <CalendarClock size={48} className="text-text-2 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text">Nenhum compromisso encontrado</h3>
          <p className="text-text-2 text-sm mt-1 max-w-md mx-auto">
            {searchQuery
              ? `Nenhum resultado corresponde à busca "${searchQuery}".`
              : "Nenhuma reunião cadastrada para os filtros selecionados."}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groupedMeetings.map(({ dateKey, dateObj, items }) => {
            const isDateToday = isToday(dateObj);
            const finoraInDate = items.filter((i) => i.source !== "MICROSOFT_365").length;
            const msInDate = items.filter((i) => i.source === "MICROSOFT_365").length;

            return (
              <div key={dateKey} className="space-y-4">
                {/* Cabeçalho da Data */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-line">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-finora-600/10 text-finora-600 font-bold text-sm">
                      📅
                    </span>
                    <div className="flex items-center gap-2.5">
                      <h3 className="font-display text-xl sm:text-2xl font-black text-text capitalize">
                        {format(dateObj, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </h3>
                      {isDateToday && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                          ⭐ HOJE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-2 font-mono">
                    <span className="font-bold text-text">{items.length} {items.length === 1 ? "compromisso" : "compromissos"}</span>
                    <span>({finoraInDate} Finora · {msInDate} Microsoft)</span>
                  </div>
                </div>

                {/* Grid de Reuniões daquele dia */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((item) => {
                    const isMs = item.source === "MICROSOFT_365";

                    // ==========================================
                    // CARD DO MICROSOFT 365 / OUTLOOK / TEAMS
                    // ==========================================
                    if (isMs) {
                      const startFormatted = item.scheduled_at
                        ? format(new Date(item.scheduled_at), "HH:mm", { locale: ptBR })
                        : "--:--";
                      const endFormatted = item.end_at
                        ? format(new Date(item.end_at), "HH:mm", { locale: ptBR })
                        : "";

                      return (
                        <div
                          key={item.id}
                          className="bg-surface border border-indigo-500/30 rounded-3xl p-5.5 transition-all hover:-translate-y-1 hover:border-indigo-500/60 hover:shadow-xl relative overflow-hidden flex flex-col justify-between"
                        >
                          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />

                          <div>
                            {/* Header: Horário & Badge de Origem */}
                            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-line">
                              <div>
                                <span className="text-2xl font-black text-text font-mono">
                                  {startFormatted}
                                </span>
                                {endFormatted && (
                                  <span className="text-xs text-text-2 font-mono ml-1">
                                    às {endFormatted}
                                  </span>
                                )}
                              </div>

                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 text-[10px] font-bold uppercase tracking-wide border border-indigo-500/30">
                                <Calendar size={11} />
                                <span>Outlook / Teams</span>
                              </span>
                            </div>

                            {/* Assunto e Detalhes */}
                            <div className="space-y-2.5">
                              <div>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                    item.hostKey === "ale"
                                      ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}
                                >
                                  <span>{item.hostKey === "ale" ? "👩‍💼 Agenda Alessandra (Ale)" : "🤵 Agenda Hugo Werninghaus"}</span>
                                </span>
                                <h4 className="text-base font-bold text-text leading-snug mt-1" title={item.subject}>
                                  {item.subject || "Reunião no Calendário Microsoft"}
                                </h4>
                              </div>

                              {item.location && (
                                <div className="flex items-center gap-2 text-xs text-text-2 bg-paper/70 px-3 py-1.5 rounded-xl border border-line">
                                  <MapPin size={14} className="text-indigo-400 shrink-0" />
                                  <span className="truncate">{item.location}</span>
                                </div>
                              )}

                              {item.organizerName && item.organizerName !== "Hugo Werninghaus" && (
                                <div className="flex items-center gap-2 text-xs text-text-2">
                                  <UserRound size={14} className="text-text-2 shrink-0" />
                                  <span>Organizado por: <strong className="text-text">{item.organizerName}</strong></span>
                                </div>
                              )}

                              {/* Status de resposta da Microsoft */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-text-2">Status:</span>
                                {item.msResponse === "organizer" && (
                                  <span className="text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                    Organizador (Hugo)
                                  </span>
                                )}
                                {item.msResponse === "accepted" && (
                                  <span className="text-sky-300 font-bold bg-sky-500/15 px-2 py-0.5 rounded-md border border-sky-500/30">
                                    Aceito no Calendário
                                  </span>
                                )}
                                {item.msResponse === "tentative" && (
                                  <span className="text-amber-300 font-bold bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                                    Provisório
                                  </span>
                                )}
                                {item.msResponse === "notResponded" && (
                                  <span className="text-purple-300 font-bold bg-purple-500/15 px-2 py-0.5 rounded-md border border-purple-500/30">
                                    Pendente de Aceite
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Ações / Link do Teams + Reagendar / Cancelar */}
                          <div className="mt-5 pt-3 border-t border-line flex flex-col gap-2">
                            {item.teamsUrl ? (
                              <a
                                href={item.teamsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                              >
                                <Video size={14} />
                                <span>Entrar no Microsoft Teams</span>
                                <ExternalLink size={12} className="opacity-70" />
                              </a>
                            ) : (
                              <div className="w-full py-2 px-3 rounded-xl bg-paper/80 border border-line-strong text-text-2 text-xs text-center font-medium">
                                Compromisso Bloqueado no Site 🔒
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openRescheduleModal(item)}
                                className="flex-1 py-2 rounded-xl bg-finora-500/15 hover:bg-finora-500/25 border border-finora-500/30 text-finora-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Reagendar compromisso na agenda Microsoft do Hugo"
                              >
                                <CalendarClock size={14} />
                                <span>Reagendar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMeeting(item)}
                                className="flex-1 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                title="Cancelar compromisso na agenda Microsoft do Hugo"
                              >
                                <Trash2 size={14} />
                                <span>Cancelar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ==========================================
                    // CARD DO AGENDAMENTO FINORA EXPERIENCE
                    // ==========================================
                    const meeting = item;
                    const isHotLead = meeting.participants.chairs_count && meeting.participants.chairs_count >= 6;

                    return (
                      <div
                        key={meeting.id}
                        className={`border rounded-3xl p-5.5 transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden flex flex-col justify-between ${
                          isHotLead
                            ? "bg-gradient-to-br from-surface via-surface to-[#221805] border-2 border-[#D4AF37]"
                            : meeting.status === "SCHEDULED"
                            ? "bg-surface border-finora-500/30 hover:border-finora-500/60"
                            : meeting.status === "COMPLETED"
                            ? "bg-surface border-emerald-500/30 hover:border-emerald-500/60"
                            : "bg-surface border-rose-500/30 opacity-75"
                        }`}
                      >
                        {isHotLead && (
                          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
                        )}

                        <div>
                          {/* Header: Time & Status */}
                          <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-line">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-2xl font-black text-text font-mono">
                                {format(new Date(meeting.scheduled_at), "HH:mm", { locale: ptBR })}
                              </span>
                              <span className="text-[11px] text-text-2 font-medium">
                                (45 min)
                              </span>
                            </div>

                            {meeting.status === "SCHEDULED" && isHotLead && (
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase border border-amber-500/40 flex items-center gap-1 shadow-xs">
                                🔥 Lead Quente ({meeting.participants.chairs_count} cad.)
                              </span>
                            )}
                            {meeting.status === "SCHEDULED" && !isHotLead && (
                              <span className="px-2.5 py-1 rounded-full bg-finora-500/15 text-finora-400 text-[10px] font-bold uppercase border border-finora-500/30">
                                Aguardando
                              </span>
                            )}
                            {meeting.status === "COMPLETED" && (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase flex items-center gap-1 border border-emerald-500/30">
                                <UserCheck size={12} /> Concluída
                              </span>
                            )}
                            {meeting.status === "NO_SHOW" && (
                              <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase flex items-center gap-1 border border-rose-500/30">
                                <UserX size={12} /> Faltou
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteMeeting(meeting.id)}
                              className="p-1 rounded-lg text-rose-400/60 hover:text-rose-300 hover:bg-rose-500/20 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer ml-1"
                              title="Excluir reunião (desmarca no site e cancela no Teams)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Body: Lead Details */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                                  meeting.hostKey === "ale"
                                    ? "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30"
                                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                }`}
                              >
                                <span>{meeting.hostKey === "ale" ? "👩‍💼 Com Alessandra (Ale)" : "🤵 Com Hugo Werninghaus"}</span>
                              </span>
                              <span className="text-[10px] font-mono text-text-2">
                                {meeting.hostEmail || "hugo@grupoqmax.com.br"}
                              </span>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-finora-500/15 text-finora-400 flex items-center justify-center shrink-0 mt-0.5">
                                <UserRound size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <strong className="text-base text-text block truncate">{meeting.participants.full_name}</strong>
                                <span className="text-xs text-text-2">
                                  Participante ID #{meeting.participants.id}
                                  {meeting.participants.cpf_formatted ? ` · CPF ${meeting.participants.cpf_formatted}` : ""}
                                </span>
                              </div>
                            </div>

                            {/* Recompensa da Roleta VIP desta pessoa */}
                            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 flex flex-col gap-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                  <Crown size={12} className="text-amber-400" />
                                  <span>Recompensa VIP (Roleta 2)</span>
                                </span>
                                {meeting.normalPrize && (
                                  <span className="text-[10px] font-mono text-text-2 flex items-center gap-1">
                                    <Gift size={10} /> Brinde: {meeting.normalPrize.name}
                                  </span>
                                )}
                              </div>
                              {meeting.vipPrize ? (
                                <strong className="text-xs sm:text-sm font-black text-amber-200">
                                  🏆 {meeting.vipPrize.name}
                                </strong>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400">
                                  ⏳ Aguardando giro na Roleta VIP
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <Mail size={16} className="text-text-2 shrink-0" />
                              <span className="text-sm text-text truncate" title={meeting.participants.email}>
                                {meeting.participants.email || "E-mail não informado"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Phone size={16} className="text-text-2 shrink-0" />
                                <span className="text-sm text-text font-medium">{meeting.participants.phone}</span>
                              </div>
                              {(() => {
                                const cleanPhone = (meeting.participants.phone || "").replace(/\D/g, "");
                                const intlPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
                                const firstName = meeting.participants.full_name.split(" ")[0];
                                const timeStr = format(new Date(meeting.scheduled_at), "HH:mm", { locale: ptBR });
                                const dateStr = format(new Date(meeting.scheduled_at), "dd/MM", { locale: ptBR });
                                const msg = `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora. Confirmando nossa consultoria VIP de diagnóstico financeiro no dia ${dateStr} às ${timeStr} com o Hugo Werninghaus (CEO). Aguardamos você! 🚀`;
                                const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
                                return (
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white transition-all text-xs font-bold shadow-xs active:scale-95 shrink-0"
                                    title="Chamar no WhatsApp Web para confirmar reunião"
                                  >
                                    <MessageSquare size={13} />
                                    <span>WhatsApp</span>
                                  </a>
                                );
                              })()}
                            </div>

                            <div className="flex items-start gap-3">
                              <Building2 size={16} className="text-text-2 mt-0.5 shrink-0" />
                              <div className="text-sm text-text">
                                <span className="block font-medium">{meeting.participants.clinic_name || "Clínica não informada"}</span>
                                {meeting.participants.cro_number && (
                                  <span className="text-xs text-text-2 block">
                                    CRO: {meeting.participants.cro_number}/{meeting.participants.cro_state}
                                  </span>
                                )}
                                {meeting.participants.chairs_count && (
                                  <span className="text-xs text-text-2 block">
                                    Porte: {meeting.participants.chairs_count} {meeting.participants.chairs_count === 1 ? "cadeira" : "cadeiras"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-5 pt-3 border-t border-line flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openRescheduleModal(meeting)}
                              className="flex-1 py-2.5 rounded-xl bg-finora-600/20 hover:bg-finora-600/30 border border-finora-500/40 text-finora-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              title="Escolher nova data e horário (atualiza no site e no Microsoft Teams/Outlook)"
                            >
                              <CalendarClock size={15} />
                              <span>Reagendar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMeeting(meeting)}
                              className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              title="Cancelar reunião (remove do site e da agenda Microsoft do Hugo)"
                            >
                              <Trash2 size={15} />
                              <span>Cancelar Reunião</span>
                            </button>
                          </div>

                          {meeting.status === "SCHEDULED" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => updateStatus(meeting.id, "COMPLETED")}
                                className="flex-1 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              >
                                <UserCheck size={14} />
                                <span>Marcar Concluída</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => updateStatus(meeting.id, "NO_SHOW")}
                                className="flex-1 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                              >
                                <UserX size={14} />
                                <span>Marcar Faltou</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-xs text-text-2 font-medium pt-1">
                              <span>Atendimento registrado</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Reagendamento (Portal no document.body) */}
      {mounted &&
        rescheduleTarget &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl rounded-3xl border border-line-strong bg-surface p-6 text-text shadow-2xl space-y-5 my-auto">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-finora-500/15 border border-finora-500/30 text-finora-400 flex items-center justify-center shrink-0">
                    <CalendarClock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text">Reagendar Reunião · Agenda Hugo</h3>
                    <p className="text-xs text-text-2">
                      {rescheduleTarget.participants?.full_name || rescheduleTarget.subject} · Horário atual:{" "}
                      <strong className="text-text">
                        {format(new Date(rescheduleTarget.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="p-1.5 rounded-xl bg-surface border border-line text-text-2 hover:text-text cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* 1. Escolha do Mês e Dia */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-2 block">
                  1. Escolha a Nova Data:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {rescheduleMonths.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => {
                        setSelectedRescheduleMonth(m.key);
                        setRescheduleDateStr("");
                        setRescheduleSlot(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                        selectedRescheduleMonth === m.key
                          ? "bg-finora-600 text-white shadow-sm"
                          : "bg-paper border border-line text-text-2 hover:text-text"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto pr-1">
                  {daysInSelectedMonth.map((d) => {
                    const isSelected = rescheduleDateStr === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setRescheduleDateStr(d.dateStr)}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer ${
                          isSelected
                            ? "border-finora-500 bg-finora-600 text-white shadow-md"
                            : "border-line bg-paper/70 text-text-2 hover:text-text hover:border-line-strong"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Escolha do Horário Livre */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-text-2 block">
                  2. Escolha o Novo Horário Livre na Agenda do Hugo:
                </span>
                {!rescheduleDateStr ? (
                  <div className="rounded-2xl border border-dashed border-line-strong bg-paper/40 p-4 text-center text-xs text-text-2">
                    👆 Selecione um dia acima para consultar os horários livres na agenda Microsoft do Hugo.
                  </div>
                ) : loadingSlots ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-xs text-text-2">
                    <LoaderCircle size={16} className="animate-spin text-finora-500" />
                    <span>Consultando disponibilidade real no Microsoft 365...</span>
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-paper/40 p-4 text-center text-xs text-text-2">
                    Nenhum horário livre neste dia. Escolha outra data acima.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                    {rescheduleSlots.map((s) => {
                      const on = rescheduleSlot === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRescheduleSlot(s)}
                          className={`py-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                            on
                              ? "border-finora-500 bg-finora-600 text-white shadow-md"
                              : "border-line bg-paper/70 text-text hover:border-finora-500/50"
                          }`}
                        >
                          {format(parseISO(s), "HH:mm")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Ações do Modal */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-text-2 hover:text-text cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  disabled={!rescheduleSlot || savingReschedule}
                  onClick={confirmReschedule}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-finora-600 hover:bg-finora-700 disabled:opacity-50 text-white text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {savingReschedule ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />
                      <span>Atualizando no site e Microsoft 365...</span>
                    </>
                  ) : rescheduleSlot ? (
                    <span>
                      Confirmar Reagendamento · Dia {format(parseISO(rescheduleSlot), "dd/MM")} ({format(parseISO(rescheduleSlot), "HH:mm")} às{" "}
                      {format(addMinutes(parseISO(rescheduleSlot), 45), "HH:mm")}) 📅
                    </span>
                  ) : (
                    <span>Selecione a Nova Data e Horário</span>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
