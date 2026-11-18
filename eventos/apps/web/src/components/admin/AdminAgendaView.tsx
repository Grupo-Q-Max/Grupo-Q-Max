"use client";

import { useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
} from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaMeeting = {
  id: number | string;
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
  participants: {
    id: number;
    full_name: string;
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
  const [searchQuery, setSearchQuery] = useState("");

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

  // Estatísticas consolidadas
  const totalItems = meetings.length;
  const finoraMeetings = meetings.filter((m) => m.source !== "MICROSOFT_365");
  const microsoftMeetings = meetings.filter((m) => m.source === "MICROSOFT_365");
  const completedCount = finoraMeetings.filter((m) => m.status === "COMPLETED").length;
  const noShowCount = finoraMeetings.filter((m) => m.status === "NO_SHOW").length;
  const waitingCount = finoraMeetings.filter((m) => m.status === "SCHEDULED").length;

  // Filtragem ativa por fonte e busca
  const filteredMeetings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return meetings.filter((m) => {
      if (filterSource === "FINORA" && m.source === "MICROSOFT_365") return false;
      if (filterSource === "MICROSOFT" && m.source !== "MICROSOFT_365") return false;

      if (!q) return true;
      const matchName = m.participants.full_name?.toLowerCase().includes(q);
      const matchClinic = m.participants.clinic_name?.toLowerCase().includes(q);
      const matchSubject = m.subject?.toLowerCase().includes(q);
      const matchPhone = m.participants.phone?.includes(q);
      return matchName || matchClinic || matchSubject || matchPhone;
    });
  }, [meetings, filterSource, searchQuery]);

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
            <div className="w-11 h-11 rounded-2xl bg-[#E6F0FF] text-finora-600 flex items-center justify-center shrink-0">
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

        {/* Abas de Filtro de Origem */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
          <div className="flex items-center gap-2">
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
              <span>Microsoft 365 / Hugo ({microsoftMeetings.length})</span>
            </button>
          </div>

          <span className="text-xs text-text-2 font-medium">
            Exibindo {filteredMeetings.length} de {totalItems}
          </span>
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
                                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                                  Agenda Hugo Werninghaus
                                </span>
                                <h4 className="text-base font-bold text-text leading-snug mt-0.5" title={item.subject}>
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

                          {/* Ações / Link do Teams */}
                          <div className="mt-5 pt-3 border-t border-line flex items-center justify-between gap-2">
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
                          </div>

                          {/* Body: Lead Details */}
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-finora-500/15 text-finora-400 flex items-center justify-center shrink-0 mt-0.5">
                                <UserRound size={16} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <strong className="text-base text-text block truncate">{meeting.participants.full_name}</strong>
                                <span className="text-xs text-text-2">Participante ID #{meeting.participants.id} · Finora VIP</span>
                              </div>
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
                        {meeting.status === "SCHEDULED" ? (
                          <div className="mt-5 pt-3 border-t border-line flex gap-2">
                            <button
                              type="button"
                              onClick={() => updateStatus(meeting.id, "COMPLETED")}
                              className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                            >
                              <UserCheck size={16} />
                              <span>Concluída</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateStatus(meeting.id, "NO_SHOW")}
                              className="flex-1 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                            >
                              <UserX size={16} />
                              <span>Faltou</span>
                            </button>
                          </div>
                        ) : (
                          <div className="mt-5 pt-3 border-t border-line text-center text-xs text-text-2 font-medium">
                            Atendimento registrado
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
