"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Crown,
  Gift,
  Calendar,
  CalendarClock,
  Search,
  RefreshCw,
  Download,
  Phone,
  Mail,
  Building2,
  UserRound,
  CheckCircle2,
  Clock,
  MessageSquare,
  LoaderCircle,
  Sparkles,
  ArrowLeft,
  Trash2,
  X,
} from "lucide-react";
import { getAdminProxyUrl, fetchApi } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { addMinutes, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type VipRewardRow = {
  participantId: number;
  fullName: string;
  cpf: string;
  cpfFormatted: string;
  phone: string;
  email: string;
  clinicName: string;
  croNumber: string | null;
  croState: string | null;
  chairsCount: number | null;
  vipCode: string | null;
  hasMeeting: boolean;
  meeting: {
    id: number;
    scheduledAt: string;
    status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
    hostKey: "hugo" | "ale";
    hostName: string;
    hostEmail: string;
  } | null;
  vipPrize: {
    drawId: number;
    participationId: number;
    prizeId: number;
    name: string;
    description: string | null;
    drawnAt: string;
    claimedAt: string | null;
    isDelivered: boolean;
  } | null;
  normalPrize: {
    drawId: number;
    participationId: number;
    prizeId: number;
    name: string;
    description: string | null;
    drawnAt: string;
    claimedAt: string | null;
    isDelivered: boolean;
  } | null;
};

export default function AdminVipRewardsView({ eventId }: { eventId: number }) {
  const toast = useToast();
  const [rows, setRows] = useState<VipRewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"MEETINGS_ONLY" | "ALL_VIP" | "PENDING_SPIN">("MEETINGS_ONLY");
  const [filterHost, setFilterHost] = useState<"ALL" | "hugo" | "ale">("ALL");
  const [filterPrize, setFilterPrize] = useState<string>("ALL");

  // Modal de Reagendamento
  const [mounted, setMounted] = useState(false);
  const [rescheduleRow, setRescheduleRow] = useState<VipRewardRow | null>(null);
  const [rescheduleDateStr, setRescheduleDateStr] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const [selectedRescheduleMonth, setSelectedRescheduleMonth] = useState<string>("2026-11");

  useEffect(() => {
    setMounted(true);
  }, []);

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

  function openRescheduleModal(row: VipRewardRow) {
    setRescheduleRow(row);
    setRescheduleDateStr("");
    setRescheduleSlots([]);
    setRescheduleSlot(null);
    if (row.meeting?.scheduledAt) {
      try {
        const mKey = format(new Date(row.meeting.scheduledAt), "yyyy-MM");
        if (rescheduleMonths.some((m) => m.key === mKey)) {
          setSelectedRescheduleMonth(mKey);
          return;
        }
      } catch {}
    }
    if (rescheduleMonths[0]) setSelectedRescheduleMonth(rescheduleMonths[0].key);
  }

  useEffect(() => {
    if (!rescheduleRow || !rescheduleDateStr) {
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
        if (!cancelled) setRescheduleSlots(Array.isArray(data) ? data : []);
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
  }, [rescheduleRow, rescheduleDateStr, eventId]);

  async function confirmReschedule() {
    if (!rescheduleRow?.meeting || !rescheduleSlot) return;
    setSavingReschedule(true);
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/${rescheduleRow.meeting.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: rescheduleSlot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Falha ao reagendar reunião");
      toast.success("Reunião reagendada com sucesso no site e na agenda Microsoft do Hugo!");
      setRescheduleRow(null);
      fetchRewards(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao reagendar reunião.");
    } finally {
      setSavingReschedule(false);
    }
  }

  async function cancelMeeting(meetingId: number) {
    if (!confirm("Tem certeza que deseja cancelar esta reunião? Isso também removerá o compromisso do calendário Microsoft Teams/Outlook do Hugo.")) {
      return;
    }
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/${meetingId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Falha ao cancelar reunião");
      toast.success("Reunião cancelada com sucesso no site e na agenda Microsoft do Hugo!");
      fetchRewards(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar reunião.");
    }
  }

  async function fetchRewards(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/vip-rewards`, { cache: "no-store" });
      if (!res.ok) throw new Error("Erro ao carregar recompensas VIP");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      if (isManual) {
        toast.success("Lista de recompensas VIP atualizada!");
      }
    } catch {
      toast.error("Não foi possível carregar as recompensas VIP.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const meetingsCount = useMemo(() => rows.filter((r) => r.hasMeeting).length, [rows]);
  const withVipPrizeCount = useMemo(() => rows.filter((r) => Boolean(r.vipPrize)).length, [rows]);
  const meetingsWithVipPrizeCount = useMemo(
    () => rows.filter((r) => r.hasMeeting && Boolean(r.vipPrize)).length,
    [rows],
  );
  const pendingVipSpinCount = useMemo(
    () => rows.filter((r) => r.hasMeeting && !r.vipPrize).length,
    [rows],
  );

  const distinctVipPrizes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.vipPrize?.name) {
        counts.set(r.vipPrize.name, (counts.get(r.vipPrize.name) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");

    return rows.filter((r) => {
      if (filterScope === "MEETINGS_ONLY" && !r.hasMeeting) return false;
      if (filterScope === "PENDING_SPIN" && (!r.hasMeeting || Boolean(r.vipPrize))) return false;

      if (filterHost !== "ALL") {
        if (!r.meeting || r.meeting.hostKey !== filterHost) return false;
      }

      if (filterPrize !== "ALL") {
        if (filterPrize === "WAITING") {
          if (r.vipPrize) return false;
        } else if (r.vipPrize?.name !== filterPrize) {
          return false;
        }
      }

      if (!q) return true;

      const matchName = r.fullName.toLowerCase().includes(q);
      const matchClinic = r.clinicName.toLowerCase().includes(q);
      const matchCpf =
        (r.cpf && qDigits && r.cpf.includes(qDigits)) ||
        (r.cpfFormatted && r.cpfFormatted.toLowerCase().includes(q));
      const matchPhone = r.phone.includes(q) || (qDigits && r.phone.replace(/\D/g, "").includes(qDigits));
      const matchVipPrize = r.vipPrize?.name.toLowerCase().includes(q) || false;
      const matchNormalPrize = r.normalPrize?.name.toLowerCase().includes(q) || false;
      const matchHost = r.meeting?.hostName.toLowerCase().includes(q) || false;

      return matchName || matchClinic || matchCpf || matchPhone || matchVipPrize || matchNormalPrize || matchHost;
    });
  }, [rows, filterScope, filterHost, filterPrize, searchQuery]);

  function exportToCsv() {
    const headers = [
      "ID Participante",
      "Nome Completo",
      "CPF",
      "WhatsApp",
      "E-mail",
      "Clínica",
      "Cadeiras",
      "Agendou Reunião",
      "Data/Hora da Reunião",
      "Sócio da Agenda",
      "Status da Reunião",
      "Recompensa Roleta VIP (Roleta 2)",
      "Data Sorteio VIP",
      "Brinde Roleta Normal (Roleta 1)",
    ];

    const escape = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const csvRows = filteredRows.map((r) => [
      escape(r.participantId),
      escape(r.fullName),
      escape(r.cpfFormatted || r.cpf),
      escape(r.phone),
      escape(r.email),
      escape(r.clinicName),
      escape(r.chairsCount || "-"),
      escape(r.hasMeeting ? "SIM" : "NÃO"),
      escape(
        r.meeting?.scheduledAt
          ? format(new Date(r.meeting.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
      ),
      escape(r.meeting?.hostName || "-"),
      escape(r.meeting?.status || "-"),
      escape(r.vipPrize?.name || "Aguardando giro na Roleta VIP"),
      escape(
        r.vipPrize?.drawnAt
          ? format(new Date(r.vipPrize.drawnAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
      ),
      escape(r.normalPrize?.name || "Não sorteado"),
    ]);

    const bom = "\uFEFF";
    const content = bom + [headers.join(";"), ...csvRows.map((row) => row.join(";"))].join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recompensas-vip-agenda-evento-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Painel Superior de Controle e Métricas */}
      <div className="bg-surface border border-line p-6 rounded-3xl shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Crown size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <span>Recompensas VIP por Agendamento</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs text-text-2">
                Identifique rapidamente qual recompensa da Roleta VIP cada pessoa que agendou reunião ganhou
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
              <input
                type="text"
                placeholder="Buscar nome, CPF, clínica ou prêmio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-line-strong rounded-xl pl-9 pr-3.5 py-2 text-text text-xs font-medium focus:border-finora-500 outline-none transition-all placeholder:text-text-2"
              />
            </div>

            <button
              type="button"
              onClick={exportToCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <Download size={14} />
              <span>Exportar Planilha</span>
            </button>

            <button
              type="button"
              onClick={() => fetchRewards(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>

            <Link
              href={`/admin/premiacoes?event=${eventId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] text-xs font-black transition-all shadow-md hover:brightness-110 shrink-0"
            >
              <Gift size={14} />
              <span>Central de Premiações (Adicionar Prêmios)</span>
            </Link>

            <Link
              href={`/admin/agenda?event=${eventId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface hover:bg-line/50 text-text-2 hover:text-text border border-line text-xs font-bold transition-all shrink-0"
            >
              <ArrowLeft size={14} />
              <span>Voltar à Agenda</span>
            </Link>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-line">
          <div className="bg-surface border border-line-strong rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-text-2 font-bold tracking-wider">
              Pessoas com Agenda Marcada
            </span>
            <strong className="text-2xl text-text font-mono font-black">{meetingsCount}</strong>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-amber-300 font-bold tracking-wider">
              Com Agenda + Prêmio VIP Sorteado
            </span>
            <strong className="text-2xl text-amber-300 font-mono font-black">{meetingsWithVipPrizeCount}</strong>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-purple-300 font-bold tracking-wider">
              Com Agenda · Aguardando Giro VIP
            </span>
            <strong className="text-2xl text-purple-300 font-mono font-black">{pendingVipSpinCount}</strong>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-emerald-400 font-bold tracking-wider">
              Total Geral de Prêmios VIP
            </span>
            <strong className="text-2xl text-emerald-400 font-mono font-black">{withVipPrizeCount}</strong>
          </div>
        </div>

        {/* Filtros Rápidos */}
        <div className="flex flex-col gap-2.5 pt-2 border-t border-line">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase text-text-2 mr-1">Exibir:</span>
            <button
              type="button"
              onClick={() => setFilterScope("MEETINGS_ONLY")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterScope === "MEETINGS_ONLY"
                  ? "bg-finora-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              📅 Pessoas que Marcaram Agenda ({meetingsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("ALL_VIP")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterScope === "ALL_VIP"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              👑 Todos com Agenda ou Giro VIP ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterScope("PENDING_SPIN")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterScope === "PENDING_SPIN"
                  ? "bg-purple-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              ⏳ Marcaram Agenda e Ainda Não Giraram VIP ({pendingVipSpinCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase text-text-2 mr-1">Agenda:</span>
            <button
              type="button"
              onClick={() => setFilterHost("ALL")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "ALL"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              Todas (Hugo + Ale)
            </button>
            <button
              type="button"
              onClick={() => setFilterHost("hugo")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "hugo"
                  ? "bg-amber-500 text-slate-950"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              🤵 Com Hugo ({rows.filter((r) => r.meeting?.hostKey === "hugo").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterHost("ale")}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterHost === "ale"
                  ? "bg-fuchsia-500 text-white"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              👩‍💼 Com Ale ({rows.filter((r) => r.meeting?.hostKey === "ale").length})
            </button>
          </div>

          {distinctVipPrizes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase text-text-2 mr-1">Prêmio VIP:</span>
              <button
                type="button"
                onClick={() => setFilterPrize("ALL")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterPrize === "ALL"
                    ? "bg-amber-500 text-slate-950"
                    : "bg-surface border border-line text-text-2 hover:text-text"
                }`}
              >
                Todas as Recompensas
              </button>
              {distinctVipPrizes.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setFilterPrize(p.name)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filterPrize === p.name
                      ? "bg-amber-500 text-slate-950"
                      : "bg-surface border border-line text-text-2 hover:text-text"
                  }`}
                >
                  🏆 {p.name} ({p.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lista de Participantes e suas Recompensas VIP */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-line rounded-3xl">
          <LoaderCircle size={40} className="animate-spin text-amber-400 mb-4" />
          <span className="text-text font-bold text-sm">Carregando recompensas VIP das pessoas que marcaram agenda...</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <Crown size={48} className="text-text-2 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text">Nenhum registro encontrado</h3>
          <p className="text-text-2 text-sm mt-1">
            Nenhum participante corresponde aos filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRows.map((row) => {
            const cleanPhone = (row.phone || "").replace(/\D/g, "");
            const intlPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
            const firstName = row.fullName.split(" ")[0];
            const waText = row.vipPrize
              ? `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora / Grupo Q-Max. Vimos seu agendamento de consultoria VIP e sua recompensa conquistada na Roleta VIP (${row.vipPrize.name}). Estamos à disposição!`
              : `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora / Grupo Q-Max. Confirmando seu agendamento de consultoria VIP conosco!`;
            const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(waText)}`;

            return (
              <div
                key={row.participantId}
                className="bg-surface border-2 border-amber-500/35 hover:border-amber-400/70 rounded-3xl p-5.5 transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden flex flex-col justify-between gap-4"
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900]" />

                <div className="space-y-3.5">
                  {/* Cabeçalho: Dados do Participante */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-line">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                        <UserRound size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-text truncate" title={row.fullName}>
                          {row.fullName}
                        </h3>
                        <span className="text-xs font-mono text-text-2 block">
                          CPF: <strong className="text-text">{row.cpfFormatted || row.cpf || "Não informado"}</strong>
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-surface border border-line text-[11px] font-mono text-text-2 shrink-0">
                      #{String(row.participantId).padStart(4, "0")}
                    </span>
                  </div>

                  {/* DESTAQUE PRINCIPAL: Recompensa da Roleta VIP */}
                  <div
                    className={`rounded-2xl p-4 border-2 ${
                      row.vipPrize
                        ? "border-[#FFD700] bg-gradient-to-br from-[#2B1B04]/90 via-[#1B1203]/95 to-[#2B1B04]/90 shadow-[0_0_20px_rgba(255,215,0,0.2)]"
                        : "border-dashed border-purple-400/40 bg-purple-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1">
                        <Crown size={13} className="text-[#FFD700]" />
                        <span>RECOMPENSA ROLETA VIP</span>
                      </span>
                      {row.vipPrize && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 size={10} /> Sorteado
                        </span>
                      )}
                    </div>

                    {row.vipPrize ? (
                      <div>
                        <strong className="text-lg font-black text-[#FFE082] block leading-snug">
                          🏆 {row.vipPrize.name}
                        </strong>
                        {row.vipPrize.description && (
                          <span className="text-xs text-slate-300 block mt-0.5">{row.vipPrize.description}</span>
                        )}
                        <span className="text-[11px] font-mono text-amber-200/80 block mt-1.5">
                          Girou em: {format(new Date(row.vipPrize.drawnAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-purple-200 font-semibold flex items-center gap-1.5 py-1">
                        <Sparkles size={14} className="text-purple-300 shrink-0" />
                        <span>Liberado pela agenda · Ainda não girou a Roleta VIP</span>
                      </div>
                    )}
                  </div>

                  {/* Brinde da Roleta Normal (Roleta 1) */}
                  <div className="rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-text-2">
                      <Gift size={14} className="text-cyan-400 shrink-0" />
                      <span>Brinde Roleta 1:</span>
                    </div>
                    <strong className="text-xs font-bold text-text">
                      {row.normalPrize ? row.normalPrize.name : "Ainda não girou"}
                    </strong>
                  </div>

                  {/* Dados da Reunião Agendada */}
                  {row.meeting ? (
                    <div className="rounded-xl border border-finora-500/30 bg-finora-500/10 p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-finora-300 flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Reunião Agendada</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            row.meeting.hostKey === "ale"
                              ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {row.meeting.hostKey === "ale" ? "👩‍💼 Com Ale" : "🤵 Com Hugo"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-text capitalize">
                        <Clock size={13} className="text-finora-400 shrink-0" />
                        <span>
                          {format(new Date(row.meeting.scheduledAt), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1.5 border-t border-finora-500/20">
                        <button
                          type="button"
                          onClick={() => openRescheduleModal(row)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-finora-600/20 hover:bg-finora-600/35 border border-finora-500/40 text-finora-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <CalendarClock size={12} />
                          <span>Reagendar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelMeeting(row.meeting!.id)}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={12} />
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-line bg-paper/40 px-3 py-2 text-xs text-text-2">
                      VIP via Cartão/Código {row.vipCode ? `(${row.vipCode})` : ""} · Sem reunião na agenda
                    </div>
                  )}

                  {/* Clínica e Contato */}
                  <div className="space-y-1.5 text-xs text-text-2 pt-1">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="shrink-0 text-text-2" />
                      <span className="truncate text-text font-medium">
                        {row.clinicName}
                        {row.chairsCount ? ` · ${row.chairsCount} cad.` : ""}
                      </span>
                    </div>
                    {row.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="shrink-0 text-text-2" />
                        <span className="truncate">{row.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rodapé com Telefone e Botão WhatsApp */}
                <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono text-text">
                    <Phone size={14} className="text-text-2" />
                    <span>{row.phone}</span>
                  </div>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <MessageSquare size={13} />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Reagendamento (Portal no document.body) */}
      {mounted &&
        rescheduleRow &&
        rescheduleRow.meeting &&
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
                      {rescheduleRow.fullName} · Horário atual:{" "}
                      <strong className="text-text">
                        {format(new Date(rescheduleRow.meeting.scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRescheduleRow(null)}
                  className="p-1.5 rounded-xl bg-surface border border-line text-text-2 hover:text-text cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

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

              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setRescheduleRow(null)}
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
