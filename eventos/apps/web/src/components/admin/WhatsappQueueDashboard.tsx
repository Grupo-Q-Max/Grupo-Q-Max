"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import {
  Send,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Users,
  Smartphone,
  XCircle,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  X,
  ExternalLink,
  Sparkles,
  Calendar,
  Layers,
  ChevronRight,
  PlayCircle
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { fetchAdminProxy } from "@/lib/api-client";

type Props = {
  eventId: number;
  eventName: string;
};

type QueueStats = {
  PENDING: number;
  PROCESSING: number;
  SENT: number;
  FAILED: number;
  total: number;
};

type QueueMessage = {
  id: number;
  phone: string;
  message?: string;
  media_url?: string | null;
  media_type?: string;
  status: string;
  attempts: number;
  next_attempt_at?: string;
  error_reason?: string | null;
  created_at: string;
  updated_at: string;
};

// Dicionário de contatos conhecidos da Campanha Dr. Igor Steinmeyer
const KNOWN_CONTACTS: Record<string, string> = {
  "5511910572810": "Manuela Santos",
  "5544991576897": "Henrique Issao",
  "5548991358485": "Fernanda Magnabosco",
  "5511934180813": "Ana Carla Araújo",
  "5511971822337": "Mariana Bedin",
  "5511981314073": "Neifi Akid",
  "5511984614877": "Amaro",
  "5511987589444": "Fe",
  "5511992681053": "Sidneis Munhoz",
  "5511994859700": "Dra. Natalia Rezende",
  "5511999115925": "Juliany",
  "5511999914329": "Regina",
  "5512982667000": "Ana Paula Dias",
  "5512997009042": "Mariana",
  "5513997372118": "Victor Lima",
  "5524992186034": "Samia Leal",
  "5527997373410": "RRBarcellos2505",
  "5531971450047": "Marcelo Queiroz",
  "5531991840512": "Raquel Lima",
  "5531994994044": "Liliany",
  "5535992025541": "Érica Carvalho",
  "5537998125671": "Jonathas Piassi",
  "5537998210053": "Thiago Mileib",
  "5537999295163": "Paula",
  "5541998990019": "Dani",
  "5541999923089": "Jéssica Lima Nesello",
  "5544984550078": "Gabriela Lima Fabri",
  "5555991012648": "Glauber Costa de Oliveira",
  "5561981913071": "Victoria Machado",
  "5562984066349": "Tia Thay",
  "5599984059241": "Dra Ester Leoncio",
  "5599991836364": "Karinne Sousa"
};

function formatPhoneDisplay(phone: string): { ddd: string; formatted: string } {
  const clean = phone.replace(/\D/g, "");
  let local = clean;
  if (local.startsWith("55") && local.length >= 12) {
    local = local.slice(2);
  }
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  const part1 = rest.slice(0, rest.length === 9 ? 5 : 4);
  const part2 = rest.slice(rest.length === 9 ? 5 : 4);
  return {
    ddd,
    formatted: `(${ddd}) ${part1}-${part2}`
  };
}

export default function WhatsappQueueDashboard({ eventId, eventName }: Props) {
  const toast = useToast();

  // State principal
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [history, setHistory] = useState<QueueMessage[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(8);

  // Filtros e busca
  const [filterDDD, setFilterDDD] = useState<"ALL" | "11" | "OTHERS">("ALL");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "PROCESSING" | "SENT" | "FAILED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  // Modais de detalhes
  const [viewingMessage, setViewingMessage] = useState<QueueMessage | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Novo disparo / automação
  const [activeTab, setActiveTab] = useState<"CAMPAIGN" | "BROADCAST">("CAMPAIGN");
  const [audience, setAudience] = useState("ALL");
  const [customBroadcastMsg, setCustomBroadcastMsg] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  async function loadDashboard() {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetchAdminProxy(`/whatsapp/queue-stats?eventId=${eventId}`),
        fetchAdminProxy(`/whatsapp/queue-history?eventId=${eventId}&limit=200`),
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (historyRes.ok) {
        const rawHistory = await historyRes.json();
        setHistory(Array.isArray(rawHistory) ? rawHistory : []);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard de filas:", err);
    } finally {
      setLoadingDashboard(false);
    }
  }

  // Polling automático
  useEffect(() => {
    loadDashboard();
  }, [eventId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          loadDashboard();
          return 8;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, eventId]);

  // Lista processada e filtrada
  const processedList = useMemo(() => {
    return history.map((item, index) => {
      const { ddd, formatted } = formatPhoneDisplay(item.phone);
      const name = KNOWN_CONTACTS[item.phone] || (ddd === "11" ? "Dono(a) de Clínica (São Paulo)" : "Dono(a) de Clínica");
      return {
        ...item,
        order: index + 1,
        ddd,
        formattedPhone: formatted,
        contactName: name,
      };
    });
  }, [history]);

  // Contagens por DDD
  const dddMetrics = useMemo(() => {
    const ddd11List = processedList.filter((c) => c.ddd === "11");
    const othersList = processedList.filter((c) => c.ddd !== "11");

    return {
      total: processedList.length,
      ddd11Total: ddd11List.length,
      ddd11Sent: ddd11List.filter((c) => c.status === "SENT").length,
      ddd11Pending: ddd11List.filter((c) => c.status === "PENDING" || c.status === "PROCESSING").length,
      othersTotal: othersList.length,
      othersSent: othersList.filter((c) => c.status === "SENT").length,
      othersPending: othersList.filter((c) => c.status === "PENDING" || c.status === "PROCESSING").length,
    };
  }, [processedList]);

  // Próximo envio programado
  const nextScheduled = useMemo(() => {
    const pendings = processedList.filter((c) => c.status === "PENDING" || c.status === "PROCESSING");
    if (pendings.length === 0) return null;
    return pendings[0];
  }, [processedList]);

  // Contatos após aplicar filtros de interface
  const filteredContacts = useMemo(() => {
    return processedList.filter((c) => {
      if (filterDDD === "11" && c.ddd !== "11") return false;
      if (filterDDD === "OTHERS" && c.ddd === "11") return false;

      if (filterStatus !== "ALL" && c.status !== filterStatus) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchName = c.contactName.toLowerCase().includes(term);
        const matchPhone = c.phone.includes(term) || c.formattedPhone.includes(term);
        const matchDDD = c.ddd.includes(term);
        if (!matchName && !matchPhone && !matchDDD) return false;
      }

      return true;
    });
  }, [processedList, filterDDD, filterStatus, searchTerm]);

  // Reenviar mensagem individual
  async function handleRetry(id: number) {
    setRetryingId(id);
    try {
      const res = await fetchAdminProxy(`/whatsapp/queue/${id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || "Falha ao reenviar");
      }
      toast.success("Mensagem reenviada para a fila de envio!", "Pronto");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setRetryingId(null);
    }
  }

  // Reenviar todas as falhas
  async function handleRetryAll() {
    if (!window.confirm("Deseja reenfileirar todas as mensagens com falha?")) return;
    setLoadingDashboard(true);
    try {
      const res = await fetchAdminProxy(`/whatsapp/queue/retry-all?eventId=${eventId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Erro ao reenfileirar.");
      toast.success("Todas as falhas foram recolocadas na fila!", "Sucesso");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
      setLoadingDashboard(false);
    }
  }

  // Disparo manual
  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!customBroadcastMsg.trim()) {
      toast.error("Digite o texto da mensagem.");
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await fetchAdminProxy(`/whatsapp/event/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          messageTemplate: customBroadcastMsg,
        }),
      });
      if (!res.ok) throw new Error("Erro no disparo em massa");
      const data = await res.json();
      toast.success(`${data.sentCount || 0} mensagens adicionadas à fila.`, "Sucesso");
      setCustomBroadcastMsg("");
      loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao disparar");
    } finally {
      setSendingBroadcast(false);
    }
  }

  // Percentual de conclusão
  const sentCount = stats?.SENT || 0;
  const totalCount = stats?.total || processedList.length || 1;
  const progressPercent = Math.min(100, Math.round((sentCount / totalCount) * 100));

  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* ─── BANNER PRINCIPAL DA CAMPANHA ─── */}
      <section className="bg-gradient-to-r from-[#170E3A] via-[#2A1654] to-[#120B2E] text-white rounded-3xl p-6 lg:p-8 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-finora-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black tracking-wide uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Fila Ativa · Modo Anti-Ban Ativado
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 text-xs font-bold">
                Evento #{eventId} · {eventName}
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white">
              Campanha Imersão Dr. Igor Steinmeyer
            </h2>
            <p className="text-purple-200/80 text-sm mt-1 leading-relaxed">
              Disparo inteligente para donos de clínicas com ingresso GOLD de cortesia. 
              Ordenação estrita por DDD (DDD 11 enviado primeiro), intervalo seguro de 60s a 150s, pausas de descanso humano e foto oficial anexada.
            </p>
          </div>

          {/* Card Próximo Envio / Status Tempo Real */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 min-w-[280px]">
            <div className="flex items-center justify-between text-xs text-purple-200 mb-2">
              <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={14} className="text-amber-300" />
                Próximo Disparo
              </span>
              {autoRefresh && (
                <span className="text-[11px] text-purple-300/80 font-mono">
                  Sincroniza em {secondsUntilRefresh}s
                </span>
              )}
            </div>

            {nextScheduled ? (
              <div>
                <p className="text-white font-black text-base truncate">
                  {nextScheduled.contactName}
                </p>
                <p className="text-purple-200 font-mono text-xs mt-0.5">
                  {nextScheduled.formattedPhone} · <span className="text-amber-300 font-bold">DDD {nextScheduled.ddd}</span>
                </p>
                <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-purple-200/90">
                  <span>Horário planejado:</span>
                  <span className="font-bold text-white">
                    {nextScheduled.next_attempt_at
                      ? new Date(nextScheduled.next_attempt_at).toLocaleTimeString("pt-BR")
                      : "Aguardando vez"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-purple-200 text-xs">
                🎉 Todas as mensagens da fila já foram processadas!
              </div>
            )}
          </div>
        </div>

        {/* Barra de Progresso Geral */}
        <div className="mt-6 pt-5 border-t border-white/10">
          <div className="flex justify-between items-center text-xs text-purple-200 mb-2">
            <span className="font-bold">
              Progresso Geral da Campanha ({sentCount} de {totalCount} enviados)
            </span>
            <span className="font-black text-white text-sm">{progressPercent}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-purple-400 via-pink-400 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-lg"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* ─── CARDS DE KPI & MÉTRICAS ─── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total da Fila */}
        <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-text-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Total na Fila</span>
            <Users size={16} className="text-text-2" />
          </div>
          <div>
            <span className="text-3xl font-black text-text">
              {stats ? stats.total : <LoaderCircle size={20} className="animate-spin text-text-2" />}
            </span>
            <p className="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <ShieldCheck size={12} /> 0 Duplicações
            </p>
          </div>
        </div>

        {/* Prioridade DDD 11 */}
        <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden border-l-4 border-l-purple-600">
          <div className="flex items-center justify-between text-text-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider text-purple-900">DDD 11 (Prioritários)</span>
            <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[10px] font-black">
              1º Fila
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-900">{dddMetrics.ddd11Total}</span>
              <span className="text-xs text-text-2">contatos</span>
            </div>
            <p className="text-[11px] text-text-2 mt-1">
              <strong className="text-purple-700">{dddMetrics.ddd11Sent}</strong> enviados · <strong className="text-amber-700">{dddMetrics.ddd11Pending}</strong> aguardando
            </p>
          </div>
        </div>

        {/* Outros DDDs */}
        <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-text-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Outros DDDs</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
              2º Fila
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-text">{dddMetrics.othersTotal}</span>
              <span className="text-xs text-text-2">contatos</span>
            </div>
            <p className="text-[11px] text-text-2 mt-1">
              <strong className="text-emerald-700">{dddMetrics.othersSent}</strong> enviados · <strong className="text-amber-700">{dddMetrics.othersPending}</strong> aguardando
            </p>
          </div>
        </div>

        {/* Status de Entrega */}
        <div className="bg-surface border border-line rounded-3xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-text-2 mb-3">
            <span className="text-xs font-black uppercase tracking-wider">Status Geral</span>
            <span className="text-emerald-600">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600">{stats ? stats.SENT : 0}</span>
              <span className="text-xs text-text-2">entregues</span>
            </div>
            <p className="text-[11px] text-text-2 mt-1">
              {stats?.FAILED ? (
                <span className="text-rose-600 font-bold">{stats.FAILED} com falha</span>
              ) : (
                <span className="text-emerald-700 font-semibold">100% livre de bloqueio</span>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ─── ABAS DE NAVEGAÇÃO INTERNA ─── */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("CAMPAIGN")}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "CAMPAIGN"
                ? "bg-purple-900 text-white shadow-md"
                : "bg-surface text-text-2 hover:text-text border border-line"
            }`}
          >
            <Layers size={16} />
            Acompanhamento da Fila ({processedList.length})
          </button>
          <button
            onClick={() => setActiveTab("BROADCAST")}
            className={`px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${
              activeTab === "BROADCAST"
                ? "bg-purple-900 text-white shadow-md"
                : "bg-surface text-text-2 hover:text-text border border-line"
            }`}
          >
            <Send size={16} />
            Novo Disparo / Personalizado
          </button>
        </div>

        {/* Controles de Atualização */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-text-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded accent-purple-600 w-4 h-4 cursor-pointer"
            />
            Auto-atualizar (8s)
          </label>
          <button
            onClick={loadDashboard}
            disabled={loadingDashboard}
            title="Atualizar agora"
            className="p-2 rounded-xl bg-surface border border-line hover:bg-paper text-text-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loadingDashboard ? "animate-spin text-purple-600" : ""} />
          </button>
        </div>
      </div>

      {/* ─── ABA 1: TABELA DE ACOMPANHAMENTO DA FILA ─── */}
      {activeTab === "CAMPAIGN" && (
        <section className="bg-surface border border-line rounded-3xl overflow-hidden shadow-sm flex flex-col">
          
          {/* Barra de Filtros e Busca */}
          <div className="p-4 lg:p-6 border-b border-line flex flex-col md:flex-row gap-4 justify-between items-center bg-paper/50">
            {/* Campo de Busca */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, DDD ou telefone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-line text-sm text-text placeholder:text-text-2/60 outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-2 hover:text-text"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filtros por DDD e Status */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex rounded-xl bg-surface border border-line p-1 text-xs font-bold text-text-2">
                <button
                  onClick={() => setFilterDDD("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterDDD === "ALL" ? "bg-purple-900 text-white" : "hover:text-text"
                  }`}
                >
                  Todos DDDs ({processedList.length})
                </button>
                <button
                  onClick={() => setFilterDDD("11")}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterDDD === "11" ? "bg-purple-900 text-white" : "hover:text-text"
                  }`}
                >
                  DDD 11 ({dddMetrics.ddd11Total})
                </button>
                <button
                  onClick={() => setFilterDDD("OTHERS")}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    filterDDD === "OTHERS" ? "bg-purple-900 text-white" : "hover:text-text"
                  }`}
                >
                  Outros ({dddMetrics.othersTotal})
                </button>
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-surface border border-line text-xs font-bold text-text outline-none focus:border-purple-600"
              >
                <option value="ALL">Todos Status</option>
                <option value="PENDING">Pendentes</option>
                <option value="PROCESSING">Processando</option>
                <option value="SENT">Enviados</option>
                <option value="FAILED">Com Falha</option>
              </select>

              {stats && stats.FAILED > 0 && (
                <button
                  onClick={handleRetryAll}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw size={14} />
                  Reenviar Falhas ({stats.FAILED})
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Destinatários */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-text-2 text-xs uppercase tracking-wider border-b border-line sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold w-16"># Ordem</th>
                  <th className="px-6 py-4 font-semibold">Destinatário</th>
                  <th className="px-6 py-4 font-semibold text-center">DDD</th>
                  <th className="px-6 py-4 font-semibold">Status de Envio</th>
                  <th className="px-6 py-4 font-semibold text-center">Foto Anexa</th>
                  <th className="px-6 py-4 font-semibold">Mensagem</th>
                  <th className="px-6 py-4 font-semibold text-right">Agendado / Enviado</th>
                  <th className="px-6 py-4 font-semibold text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredContacts.map((msg) => {
                  const isDdd11 = msg.ddd === "11";
                  return (
                    <tr
                      key={msg.id}
                      className={`hover:bg-paper/70 transition-colors ${
                        msg.status === "PROCESSING" ? "bg-purple-50/40" : ""
                      }`}
                    >
                      {/* # Ordem */}
                      <td className="px-6 py-4 text-xs font-mono font-bold text-text-2">
                        #{msg.order}
                      </td>

                      {/* Destinatário */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-text text-sm">
                            {msg.contactName}
                          </span>
                          <span className="text-xs text-text-2 font-mono flex items-center gap-1 mt-0.5">
                            <Smartphone size={12} />
                            {msg.formattedPhone}
                          </span>
                        </div>
                      </td>

                      {/* DDD Tag */}
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black border ${
                            isDdd11
                              ? "bg-purple-100 text-purple-900 border-purple-200"
                              : "bg-slate-100 text-slate-800 border-slate-200"
                          }`}
                        >
                          {msg.ddd}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {msg.status === "SENT" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            Enviado com Sucesso
                          </span>
                        )}
                        {msg.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200">
                            <Clock size={13} className="text-amber-600" />
                            Aguardando na Fila
                          </span>
                        )}
                        {msg.status === "PROCESSING" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-bold border border-purple-300 animate-pulse">
                            <RefreshCw size={13} className="animate-spin text-purple-700" />
                            Enviando Agora...
                          </span>
                        )}
                        {msg.status === "FAILED" && (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200">
                              <XCircle size={13} className="text-rose-600" />
                              Falhou
                            </span>
                            {msg.error_reason && (
                              <span
                                className="text-[10px] text-rose-600 truncate max-w-[180px]"
                                title={msg.error_reason}
                              >
                                {msg.error_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Foto Anexa */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setViewingImage("/disparos/midia.jpg")}
                          className="group relative inline-block rounded-xl overflow-hidden border border-line shadow-sm hover:border-purple-600 transition-all"
                          title="Clique para ver a foto oficial da campanha"
                        >
                          <Image
                            src="/disparos/midia.jpg"
                            alt="Mídia da Campanha"
                            width={40}
                            height={40}
                            className="object-cover group-hover:scale-110 transition-transform"
                          />
                        </button>
                      </td>

                      {/* Mensagem Preview */}
                      <td className="px-6 py-4">
                        <div className="max-w-[240px]">
                          <p className="text-xs text-text truncate">
                            {msg.message || "🎁 DONO DE CLÍNICA, SEU PRÓXIMO PASSO..."}
                          </p>
                          <button
                            onClick={() => setViewingMessage(msg)}
                            className="text-[11px] font-bold text-purple-700 hover:text-purple-900 underline mt-0.5 flex items-center gap-1"
                          >
                            <Eye size={11} /> Ler Mensagem Completa
                          </button>
                        </div>
                      </td>

                      {/* Agendado / Enviado */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-text">
                            {msg.status === "SENT"
                              ? new Date(msg.updated_at).toLocaleTimeString("pt-BR")
                              : msg.next_attempt_at
                              ? new Date(msg.next_attempt_at).toLocaleTimeString("pt-BR")
                              : "Programado"}
                          </span>
                          <span className="text-[10px] text-text-2">
                            {msg.status === "SENT"
                              ? new Date(msg.updated_at).toLocaleDateString("pt-BR")
                              : msg.next_attempt_at
                              ? new Date(msg.next_attempt_at).toLocaleDateString("pt-BR")
                              : "Hoje"}
                          </span>
                        </div>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-center">
                        {msg.status === "FAILED" ? (
                          <button
                            onClick={() => handleRetry(msg.id)}
                            disabled={retryingId === msg.id}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 mx-auto"
                            title="Tentar reenviar agora"
                          >
                            <RefreshCw size={12} className={retryingId === msg.id ? "animate-spin" : ""} />
                            Reenviar
                          </button>
                        ) : (
                          <span className="text-xs text-text-2 font-mono">
                            {msg.attempts}/2
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredContacts.length === 0 && !loadingDashboard && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-text-2">
                      Nenhum contato encontrado com os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── ABA 2: NOVO DISPARO / BROADCAST ─── */}
      {activeTab === "BROADCAST" && (
        <section className="bg-surface border border-line rounded-3xl p-6 lg:p-8 shadow-sm max-w-3xl">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-line">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center border border-purple-200">
              <Send size={22} className="text-purple-900" />
            </div>
            <div>
              <h2 className="text-text font-black text-xl">Novo Disparo em Massa</h2>
              <p className="text-text-2 text-xs mt-0.5">
                Envie mensagens personalizadas utilizando os parâmetros Anti-Ban seguros da FINORA.
              </p>
            </div>
          </div>

          <form onSubmit={handleBroadcast} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-text">Público-alvo</span>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="bg-surface border border-line p-3 rounded-xl text-text outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
              >
                <option value="ALL">Todos os participantes cadastrados</option>
                <option value="PENDING_SPIN">Participantes que ainda não giraram a roleta</option>
                <option value="CLAIMED">Participantes que já retiraram o prêmio no estande</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-text">Template de Mensagem</span>
                <span className="text-xs text-text-2">Suporta Spintax {'{A|B}'} e {'{nome}'}</span>
              </div>
              <textarea
                value={customBroadcastMsg}
                onChange={(e) => setCustomBroadcastMsg(e.target.value)}
                placeholder="Digite a mensagem ou use Spintax. Ex: {Olá|Oi}, {nome}!..."
                className="bg-surface border border-line p-4 rounded-xl text-text outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600 min-h-[180px] font-mono text-sm resize-y"
              />
            </label>

            <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-3">
              <ShieldCheck size={18} className="shrink-0 mt-0.5 text-purple-700" />
              <div>
                <strong className="block font-black mb-0.5">Proteção Anti-Bloqueio Automática</strong>
                O sistema espaçará automaticamente cada envio entre 60 e 150 segundos, com pausas humanas entre lotes de 15 mensagens e respeito estrito ao horário comercial.
              </div>
            </div>

            <button
              type="submit"
              disabled={sendingBroadcast}
              className="py-4 px-6 rounded-2xl bg-purple-900 hover:bg-purple-950 text-white font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendingBroadcast ? (
                <>
                  <LoaderCircle size={18} className="animate-spin" />
                  Agendando Disparo na Fila...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Enfileirar Disparos
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* ─── MODAL: VER MENSAGEM COMPLETA ─── */}
      {viewingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-line rounded-3xl max-w-xl w-full p-6 lg:p-8 shadow-2xl relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setViewingMessage(null)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-paper text-text-2 hover:text-text transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-line">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Smartphone size={18} className="text-purple-900" />
              </div>
              <div>
                <h3 className="font-black text-lg text-text">
                  {viewingMessage.phone in KNOWN_CONTACTS
                    ? KNOWN_CONTACTS[viewingMessage.phone]
                    : "Destinatário VIP"}
                </h3>
                <p className="text-xs text-text-2 font-mono">
                  {formatPhoneDisplay(viewingMessage.phone).formatted} · Status: {viewingMessage.status}
                </p>
              </div>
            </div>

            {/* Balão do WhatsApp */}
            <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-[#EFEAE2] border border-[#DDD5C7] text-slate-900 text-sm whitespace-pre-wrap font-sans leading-relaxed shadow-inner">
              {viewingMessage.message}
            </div>

            <div className="mt-5 pt-4 border-t border-line flex justify-end">
              <button
                onClick={() => setViewingMessage(null)}
                className="px-5 py-2.5 rounded-xl bg-purple-900 text-white font-bold text-sm hover:bg-purple-950 transition-colors"
              >
                Fechar Visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: AMPLIAR IMAGEM OFICIAL ─── */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer"
          onClick={() => setViewingImage(null)}
        >
          <div
            className="relative max-w-lg w-full bg-surface rounded-3xl p-4 border border-white/20 shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <X size={18} />
            </button>
            <div className="rounded-2xl overflow-hidden">
              <Image
                src={viewingImage}
                alt="Foto da Campanha"
                width={800}
                height={800}
                className="w-full h-auto object-contain"
              />
            </div>
            <div className="mt-3 text-center text-xs text-text-2 font-medium">
              Imagem oficial enviada na legenda com a mensagem do Dr. Igor Steinmeyer
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
