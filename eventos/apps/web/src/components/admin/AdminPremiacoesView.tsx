"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Trophy,
  Crown,
  Gift,
  Search,
  RefreshCw,
  Download,
  Plus,
  Edit3,
  CheckCircle2,
  AlertCircle,
  UserRound,
  Phone,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
  LoaderCircle,
  X,
  Check,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type PrizeOption = {
  id: number;
  name: string;
  description: string | null;
  isVip: boolean;
  availableStock: number;
};

type PremiacaoItem = {
  participantId: number;
  primaryParticipationId: number | null;
  fullName: string;
  cpf: string;
  cpfFormatted: string;
  phone: string;
  email: string;
  clinicName: string;
  chairsCount: number | null;
  registeredAt: string;
  isVip: boolean;
  vipCode: string | null;
  hasMeeting: boolean;
  meeting: {
    id: number;
    scheduledAt: string;
    status: string;
    hostKey: "hugo" | "ale";
    hostName: string;
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
    source: string;
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
    source: string;
  } | null;
};

export default function AdminPremiacoesView({ eventId }: { eventId: number }) {
  const toast = useToast();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [normalPrizes, setNormalPrizes] = useState<PrizeOption[]>([]);
  const [vipPrizes, setVipPrizes] = useState<PrizeOption[]>([]);
  const [items, setItems] = useState<PremiacaoItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<
    "ALL" | "WITH_PRIZE" | "WITHOUT_PRIZE" | "VIP_WINNERS" | "NORMAL_WINNERS" | "WITH_MEETING"
  >("ALL");

  // Modal de Lançar / Editar Premiação
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);
  const [participantSearch, setParticipantSearch] = useState("");
  const [selectedNormalPrizeId, setSelectedNormalPrizeId] = useState<string>("");
  const [selectedVipPrizeId, setSelectedVipPrizeId] = useState<string>("");
  const [customNormalName, setCustomNormalName] = useState("");
  const [customVipName, setCustomVipName] = useState("");
  const [markDelivered, setMarkDelivered] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function fetchPremiacoes(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/draws/event/${eventId}/premiacoes`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha ao carregar premiações");
      const data = await res.json();
      setNormalPrizes(Array.isArray(data.normalPrizes) ? data.normalPrizes : []);
      setVipPrizes(Array.isArray(data.vipPrizes) ? data.vipPrizes : []);
      setItems(Array.isArray(data.items) ? data.items : []);
      if (isManual) {
        toast.success("Lista de premiações atualizada com sucesso!");
      }
    } catch {
      toast.error("Não foi possível carregar as premiações do evento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchPremiacoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const totalParticipants = items.length;
  const withAnyPrizeCount = useMemo(
    () => items.filter((i) => Boolean(i.normalPrize) || Boolean(i.vipPrize)).length,
    [items],
  );
  const withoutAnyPrizeCount = useMemo(
    () => items.filter((i) => !i.normalPrize && !i.vipPrize).length,
    [items],
  );
  const normalWinnersCount = useMemo(
    () => items.filter((i) => Boolean(i.normalPrize)).length,
    [items],
  );
  const vipWinnersCount = useMemo(
    () => items.filter((i) => Boolean(i.vipPrize)).length,
    [items],
  );
  const withMeetingCount = useMemo(
    () => items.filter((i) => i.hasMeeting).length,
    [items],
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");

    return items.filter((item) => {
      if (filterMode === "WITH_PRIZE" && !item.normalPrize && !item.vipPrize) return false;
      if (filterMode === "WITHOUT_PRIZE" && (item.normalPrize || item.vipPrize)) return false;
      if (filterMode === "VIP_WINNERS" && !item.vipPrize) return false;
      if (filterMode === "NORMAL_WINNERS" && !item.normalPrize) return false;
      if (filterMode === "WITH_MEETING" && !item.hasMeeting) return false;

      if (!q) return true;

      const matchName = item.fullName.toLowerCase().includes(q);
      const matchClinic = item.clinicName.toLowerCase().includes(q);
      const matchCpf =
        (item.cpf && qDigits && item.cpf.includes(qDigits)) ||
        (item.cpfFormatted && item.cpfFormatted.toLowerCase().includes(q));
      const matchPhone =
        item.phone.includes(q) || (qDigits && item.phone.replace(/\D/g, "").includes(qDigits));
      const matchNormal = item.normalPrize?.name.toLowerCase().includes(q) || false;
      const matchVip = item.vipPrize?.name.toLowerCase().includes(q) || false;

      return matchName || matchClinic || matchCpf || matchPhone || matchNormal || matchVip;
    });
  }, [items, filterMode, searchQuery]);

  function openAssignModal(item?: PremiacaoItem) {
    if (item) {
      setSelectedParticipantId(item.participantId);
      setParticipantSearch("");
      setSelectedNormalPrizeId(item.normalPrize ? String(item.normalPrize.prizeId) : "NONE");
      setSelectedVipPrizeId(item.vipPrize ? String(item.vipPrize.prizeId) : "NONE");
    } else {
      setSelectedParticipantId(null);
      setParticipantSearch("");
      setSelectedNormalPrizeId("NONE");
      setSelectedVipPrizeId("NONE");
    }
    setCustomNormalName("");
    setCustomVipName("");
    setMarkDelivered(true);
    setModalOpen(true);
  }

  function handleSelectParticipantInModal(p: PremiacaoItem) {
    setSelectedParticipantId(p.participantId);
    setSelectedNormalPrizeId(p.normalPrize ? String(p.normalPrize.prizeId) : "NONE");
    setSelectedVipPrizeId(p.vipPrize ? String(p.vipPrize.prizeId) : "NONE");
  }

  const selectedParticipant = useMemo(
    () => items.find((i) => i.participantId === selectedParticipantId) || null,
    [items, selectedParticipantId],
  );

  const modalFilteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    if (!q) return items.slice(0, 30);
    return items
      .filter((i) => {
        const matchName = i.fullName.toLowerCase().includes(q);
        const matchCpf =
          (i.cpf && qDigits && i.cpf.includes(qDigits)) ||
          (i.cpfFormatted && i.cpfFormatted.toLowerCase().includes(q));
        const matchClinic = i.clinicName.toLowerCase().includes(q);
        return matchName || matchCpf || matchClinic;
      })
      .slice(0, 30);
  }, [items, participantSearch]);

  async function handleSaveAssign() {
    if (!selectedParticipantId) {
      toast.error("Selecione o participante primeiro.");
      return;
    }

    setSaving(true);
    try {
      const proxyUrl = getAdminProxyUrl();
      const payload: Record<string, unknown> = {
        markDelivered,
      };

      if (selectedNormalPrizeId === "CUSTOM") {
        if (!customNormalName.trim()) {
          toast.error("Digite o nome do brinde da Roleta 1.");
          setSaving(false);
          return;
        }
        payload.customNormalPrizeName = customNormalName.trim();
      } else if (selectedNormalPrizeId === "NONE") {
        payload.normalPrizeId = null;
      } else if (selectedNormalPrizeId) {
        payload.normalPrizeId = Number(selectedNormalPrizeId);
      }

      if (selectedVipPrizeId === "CUSTOM") {
        if (!customVipName.trim()) {
          toast.error("Digite o nome da recompensa da Roleta VIP.");
          setSaving(false);
          return;
        }
        payload.customVipPrizeName = customVipName.trim();
      } else if (selectedVipPrizeId === "NONE") {
        payload.vipPrizeId = null;
      } else if (selectedVipPrizeId) {
        payload.vipPrizeId = Number(selectedVipPrizeId);
      }

      const res = await fetch(
        `${proxyUrl}/draws/event/${eventId}/participant/${selectedParticipantId}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Falha ao salvar premiação");
      }

      toast.success(data.message || "Premiação salva com sucesso!");
      setModalOpen(false);
      fetchPremiacoes(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar premiação.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetDrawsAndHistory(item: PremiacaoItem) {
    if (
      !confirm(
        `Tem certeza que deseja apagar os giros e o histórico de premiação de "${item.fullName}"? O estoque dos brindes será devolvido como se nada tivesse sido girado.`,
      )
    ) {
      return;
    }

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(
        `${proxyUrl}/draws/event/${eventId}/participant/${item.participantId}/reset`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Falha ao apagar giro e histórico");
      toast.success(data.message || "Giro e histórico apagados com sucesso!");
      fetchPremiacoes(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao apagar giro e histórico.");
    }
  }

  function exportToCsv() {
    const headers = [
      "ID Participante",
      "Nome Completo",
      "CPF",
      "WhatsApp",
      "E-mail",
      "Clínica",
      "Cadeiras",
      "Brinde Roleta 1 (Normal)",
      "Status Entrega Roleta 1",
      "Recompensa Roleta 2 (VIP)",
      "Status Entrega Roleta VIP",
      "Tem Reunião Agendada",
      "Data/Hora Reunião",
      "Sócio Reunião",
    ];

    const escape = (val: unknown) => {
      if (val === null || val === undefined) return '""';
      return `"${String(val).replace(/"/g, '""')}"`;
    };

    const csvRows = filteredItems.map((r) => [
      escape(r.participantId),
      escape(r.fullName),
      escape(r.cpfFormatted || r.cpf),
      escape(r.phone),
      escape(r.email),
      escape(r.clinicName),
      escape(r.chairsCount || "-"),
      escape(r.normalPrize?.name || "Sem brinde registrado"),
      escape(r.normalPrize ? (r.normalPrize.isDelivered ? "ENTREGUE" : "PENDENTE") : "-"),
      escape(r.vipPrize?.name || "Sem recompensa VIP registrada"),
      escape(r.vipPrize ? (r.vipPrize.isDelivered ? "ENTREGUE" : "PENDENTE") : "-"),
      escape(r.hasMeeting ? "SIM" : "NÃO"),
      escape(
        r.meeting?.scheduledAt
          ? format(new Date(r.meeting.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
          : "-",
      ),
      escape(r.meeting?.hostName || "-"),
    ]);

    const bom = "\uFEFF";
    const content = bom + [headers.join(";"), ...csvRows.map((row) => row.join(";"))].join("\r\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `premiacoes-completas-evento-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Barra Superior e Métricas */}
      <div className="bg-surface border border-line p-6 rounded-3xl shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text flex items-center gap-2">
                <span>Central de Premiações (Roleta 1 + Roleta VIP)</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </h2>
              <p className="text-xs text-text-2">
                Veja tudo o que cada participante ganhou e adicione ou edite manualmente qualquer prêmio que não tenha sido salvo
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
              onClick={() => openAssignModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] text-xs font-black transition-all shadow-md hover:brightness-110 cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>Lançar Prêmio Manual</span>
            </button>

            <button
              type="button"
              onClick={exportToCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all cursor-pointer shrink-0"
            >
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={() => fetchPremiacoes(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-line">
          <div className="bg-surface border border-line-strong rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-text-2 font-bold tracking-wider">
              Total de Participantes
            </span>
            <strong className="text-2xl text-text font-mono font-black">{totalParticipants}</strong>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-emerald-400 font-bold tracking-wider">
              Com Prêmios Salvos
            </span>
            <strong className="text-2xl text-emerald-400 font-mono font-black">{withAnyPrizeCount}</strong>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-cyan-300 font-bold tracking-wider">
              Brindes Roleta 1 (Normal)
            </span>
            <strong className="text-2xl text-cyan-300 font-mono font-black">{normalWinnersCount}</strong>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="block text-[10px] uppercase text-amber-300 font-bold tracking-wider">
              Recompensas Roleta VIP
            </span>
            <strong className="text-2xl text-amber-300 font-mono font-black">{vipWinnersCount}</strong>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-3 text-center col-span-2 sm:col-span-1">
            <span className="block text-[10px] uppercase text-rose-300 font-bold tracking-wider">
              Sem Prêmio Salvo
            </span>
            <strong className="text-2xl text-rose-300 font-mono font-black">{withoutAnyPrizeCount}</strong>
          </div>
        </div>

        {/* Abas de Filtro */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterMode("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "ALL"
                  ? "bg-finora-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              Todos ({totalParticipants})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("WITH_PRIZE")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "WITH_PRIZE"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              🏆 Com Prêmios Ganhos ({withAnyPrizeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("WITHOUT_PRIZE")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "WITHOUT_PRIZE"
                  ? "bg-rose-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              ⚠️ Sem Prêmio Salvo · Lançar ({withoutAnyPrizeCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("VIP_WINNERS")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "VIP_WINNERS"
                  ? "bg-amber-500 text-slate-950 shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              👑 Ganhadores Roleta VIP ({vipWinnersCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("NORMAL_WINNERS")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "NORMAL_WINNERS"
                  ? "bg-cyan-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              🎁 Ganhadores Roleta 1 ({normalWinnersCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("WITH_MEETING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterMode === "WITH_MEETING"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              📅 Com Agenda Marcada ({withMeetingCount})
            </button>
          </div>

          <span className="text-xs text-text-2 font-medium">
            Exibindo {filteredItems.length} de {totalParticipants}
          </span>
        </div>
      </div>

      {/* Grid de Participantes e Premiações */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-line rounded-3xl">
          <LoaderCircle size={40} className="animate-spin text-amber-400 mb-4" />
          <span className="text-text font-bold text-sm">Carregando todas as premiações do evento...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <Trophy size={48} className="text-text-2 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text">Nenhum participante encontrado</h3>
          <p className="text-text-2 text-sm mt-1">
            Tente ajustar os filtros ou o termo de busca acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const hasAnyPrize = Boolean(item.normalPrize) || Boolean(item.vipPrize);
            const cleanPhone = (item.phone || "").replace(/\D/g, "");
            const intlPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
            const firstName = item.fullName.split(" ")[0];
            const prizesWonText = [item.normalPrize?.name, item.vipPrize?.name].filter(Boolean).join(" + ");
            const waText = prizesWonText
              ? `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora / Grupo Q-Max. Registramos sua premiação no evento (${prizesWonText}). Estamos à disposição!`
              : `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora / Grupo Q-Max.`;
            const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(waText)}`;

            return (
              <div
                key={item.participantId}
                className={`bg-surface rounded-3xl p-5.5 transition-all hover:-translate-y-1 hover:shadow-xl relative overflow-hidden flex flex-col justify-between gap-4 border ${
                  item.vipPrize
                    ? "border-2 border-amber-500/45"
                    : hasAnyPrize
                    ? "border-emerald-500/35"
                    : "border-rose-500/30"
                }`}
              >
                <div
                  className={`absolute top-0 left-0 w-full h-1.5 ${
                    item.vipPrize
                      ? "bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900]"
                      : hasAnyPrize
                      ? "bg-gradient-to-r from-emerald-400 to-cyan-500"
                      : "bg-gradient-to-r from-rose-500/60 to-amber-500/60"
                  }`}
                />

                <div className="space-y-3.5">
                  {/* Cabeçalho do Participante */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-line">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-finora-500/15 border border-finora-500/30 text-finora-300 flex items-center justify-center shrink-0 mt-0.5">
                        <UserRound size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-black text-text truncate" title={item.fullName}>
                          {item.fullName}
                        </h3>
                        <span className="text-xs font-mono text-text-2 block">
                          CPF: <strong className="text-text">{item.cpfFormatted || item.cpf || "Não informado"}</strong>
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-lg bg-paper border border-line text-[11px] font-mono text-text-2 shrink-0">
                      #{String(item.participantId).padStart(4, "0")}
                    </span>
                  </div>

                  {/* 1. Brinde da Roleta 1 (Normal) */}
                  <div
                    className={`rounded-2xl p-3.5 border ${
                      item.normalPrize
                        ? "border-cyan-500/40 bg-cyan-950/20"
                        : "border-dashed border-line-strong bg-paper/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                        <Gift size={13} className="text-cyan-400" />
                        <span>BRINDE ROLETA 1 (NORMAL)</span>
                      </span>
                      {item.normalPrize && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 size={10} /> {item.normalPrize.isDelivered ? "Entregue" : "Sorteado"}
                        </span>
                      )}
                    </div>
                    {item.normalPrize ? (
                      <div>
                        <strong className="text-sm sm:text-base font-black text-white block">
                          🎁 {item.normalPrize.name}
                        </strong>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                          Registrado em: {format(new Date(item.normalPrize.drawnAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-text-2 flex items-center gap-1.5 py-0.5">
                        <AlertCircle size={13} className="text-rose-400 shrink-0" />
                        <span>Nenhum brinde da Roleta 1 salvo</span>
                      </div>
                    )}
                  </div>

                  {/* 2. Recompensa da Roleta 2 (VIP) */}
                  <div
                    className={`rounded-2xl p-3.5 border ${
                      item.vipPrize
                        ? "border-[#FFD700] bg-gradient-to-br from-[#2B1B04]/90 via-[#1B1203]/95 to-[#2B1B04]/90 shadow-[0_0_15px_rgba(255,215,0,0.15)]"
                        : item.isVip
                        ? "border-dashed border-amber-400/50 bg-amber-950/20"
                        : "border-dashed border-line bg-paper/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#FFD700] flex items-center gap-1">
                        <Crown size={13} className="text-[#FFD700]" />
                        <span>RECOMPENSA ROLETA 2 (VIP)</span>
                      </span>
                      {item.vipPrize && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 size={10} /> {item.vipPrize.isDelivered ? "Entregue" : "Sorteado"}
                        </span>
                      )}
                    </div>
                    {item.vipPrize ? (
                      <div>
                        <strong className="text-sm sm:text-base font-black text-[#FFE082] block">
                          🏆 {item.vipPrize.name}
                        </strong>
                        <span className="text-[11px] font-mono text-amber-200/80 block mt-0.5">
                          Registrado em: {format(new Date(item.vipPrize.drawnAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-text-2 flex items-center gap-1.5 py-0.5">
                        <Sparkles size={13} className={item.isVip ? "text-amber-400 shrink-0" : "text-text-2 shrink-0"} />
                        <span>
                          {item.isVip
                            ? "Elegível VIP (Agenda/Código) · Sem prêmio VIP salvo"
                            : "Nenhuma recompensa VIP salva"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info de Reunião e Clínica */}
                  {item.meeting && (
                    <div className="rounded-xl border border-finora-500/30 bg-finora-500/10 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-finora-300 flex items-center gap-1.5">
                        <Calendar size={13} />
                        <span>
                          Agenda: {format(new Date(item.meeting.scheduledAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-surface text-text-2">
                        {item.meeting.hostKey === "ale" ? "Ale" : "Hugo"}
                      </span>
                    </div>
                  )}

                  <div className="space-y-1 text-xs text-text-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Building2 size={13} className="shrink-0" />
                      <span className="truncate text-text font-medium">{item.clinicName}</span>
                    </div>
                    {item.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="shrink-0" />
                        <span className="truncate">{item.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações do Card: Botão Principal para Adicionar / Editar o que Ganhou */}
                <div className="pt-3 border-t border-line space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openAssignModal(item)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        hasAnyPrize
                          ? "bg-finora-600 hover:bg-finora-700 text-white"
                          : "bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] hover:brightness-110"
                      }`}
                    >
                      {hasAnyPrize ? (
                        <>
                          <Edit3 size={14} />
                          <span>Editar Prêmios</span>
                        </>
                      ) : (
                        <>
                          <Plus size={15} />
                          <span>Adicionar o que Ganhou</span>
                        </>
                      )}
                    </button>

                    {hasAnyPrize && (
                      <button
                        type="button"
                        onClick={() => handleResetDrawsAndHistory(item)}
                        className="py-2.5 px-3 rounded-xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                        title="Apagar giro e histórico deste participante (devolve o estoque como se não tivesse girado)"
                      >
                        <Trash2 size={14} />
                        <span>Apagar Giro</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-text-2">
                      <Phone size={13} />
                      <span>{item.phone}</span>
                    </div>
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white text-xs font-bold transition-all shadow-xs"
                    >
                      <MessageSquare size={12} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para Adicionar / Editar o que a Pessoa Ganhou */}
      {mounted &&
        modalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="w-full max-w-xl rounded-3xl border border-line-strong bg-surface p-6 text-text shadow-2xl space-y-5 my-auto">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text">
                      {selectedParticipant
                        ? `Premiação de ${selectedParticipant.fullName}`
                        : "Lançar Premiação Manual"}
                    </h3>
                    <p className="text-xs text-text-2">
                      Selecione ou digite o que esta pessoa ganhou na Roleta 1 (Brinde) e/ou na Roleta 2 (VIP)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-xl bg-surface border border-line text-text-2 hover:text-text cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Seleção de Participante (caso tenha clicado no botão geral "+ Lançar Prêmio Manual") */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-text-2 block">
                  1. Participante:
                </label>
                {selectedParticipant ? (
                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 px-4 py-3">
                    <div>
                      <strong className="text-sm font-black text-white block">
                        {selectedParticipant.fullName}
                      </strong>
                      <span className="text-xs font-mono text-slate-300">
                        CPF: {selectedParticipant.cpfFormatted || selectedParticipant.cpf || "Não informado"} ·{" "}
                        {selectedParticipant.clinicName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedParticipantId(null)}
                      className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                    >
                      Trocar pessoa
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
                      <input
                        type="text"
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        placeholder="Digite o nome ou CPF do participante..."
                        className="w-full rounded-xl border border-line-strong bg-paper pl-9 pr-3.5 py-2.5 text-xs font-medium text-text focus:border-finora-500 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-2xl border border-line bg-paper/60 divide-y divide-line">
                      {modalFilteredParticipants.map((p) => (
                        <button
                          key={p.participantId}
                          type="button"
                          onClick={() => handleSelectParticipantInModal(p)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-finora-500/15 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0">
                            <strong className="text-xs font-bold text-text block truncate">
                              {p.fullName}
                            </strong>
                            <span className="text-[11px] font-mono text-text-2">
                              CPF: {p.cpfFormatted || p.cpf || "-"} · {p.clinicName}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-finora-400 shrink-0">
                            Selecionar →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Brinde da Roleta 1 (Normal) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Gift size={14} />
                  <span>2. O que ganhou na Roleta 1 (Brindes Normais)?</span>
                </label>
                <select
                  value={selectedNormalPrizeId}
                  onChange={(e) => setSelectedNormalPrizeId(e.target.value)}
                  className="w-full rounded-xl border border-line-strong bg-paper px-3.5 py-3 text-sm font-bold text-text focus:border-cyan-400 outline-none"
                >
                  <option value="NONE">— Nenhum brinde da Roleta 1 —</option>
                  {normalPrizes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      🎁 {p.name}
                    </option>
                  ))}
                  <option value="CUSTOM">✍️ Outro brinde (Digitar nome manualmente)...</option>
                </select>

                {selectedNormalPrizeId === "CUSTOM" && (
                  <input
                    type="text"
                    value={customNormalName}
                    onChange={(e) => setCustomNormalName(e.target.value)}
                    placeholder="Digite o nome do brinde que a pessoa ganhou (ex.: Copo Térmico, Necessaire...)"
                    className="w-full rounded-xl border border-cyan-500/50 bg-paper px-3.5 py-2.5 text-sm text-text focus:border-cyan-400 outline-none"
                    autoFocus
                  />
                )}
              </div>

              {/* 3. Recompensa da Roleta 2 (VIP) */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Crown size={14} />
                  <span>3. O que ganhou na Roleta 2 (Recompensa VIP)?</span>
                </label>
                <select
                  value={selectedVipPrizeId}
                  onChange={(e) => setSelectedVipPrizeId(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/40 bg-paper px-3.5 py-3 text-sm font-bold text-text focus:border-amber-400 outline-none"
                >
                  <option value="NONE">— Nenhuma recompensa da Roleta VIP —</option>
                  {vipPrizes.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      🏆 {p.name}
                    </option>
                  ))}
                  <option value="CUSTOM">✍️ Outra recompensa VIP (Digitar manualmente)...</option>
                </select>

                {selectedVipPrizeId === "CUSTOM" && (
                  <input
                    type="text"
                    value={customVipName}
                    onChange={(e) => setCustomVipName(e.target.value)}
                    placeholder="Digite a recompensa VIP conquistada (ex.: 100% Isenção 1º Honorário...)"
                    className="w-full rounded-xl border border-amber-500/50 bg-paper px-3.5 py-2.5 text-sm text-text focus:border-amber-400 outline-none"
                    autoFocus
                  />
                )}
              </div>

              {/* 4. Marcar como entregue */}
              <label className="flex items-center gap-2.5 rounded-xl border border-line bg-paper/50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={markDelivered}
                  onChange={(e) => setMarkDelivered(e.target.checked)}
                  className="size-4 accent-emerald-500"
                />
                <span className="text-xs font-semibold text-text">
                  Contabilizar como <strong>Prêmio Entregue</strong> (soma automaticamente no contador de brindes entregues do Telão)
                </span>
              </label>

              {/* Botões do Modal */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-text-2 hover:text-text cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedParticipantId || saving}
                  onClick={handleSaveAssign}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FFE57F] via-[#FFD700] to-[#FF9900] text-[#3E2723] text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <LoaderCircle size={15} className="animate-spin" />
                      <span>Salvando Premiação...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Salvar Premiação do Participante</span>
                    </>
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
