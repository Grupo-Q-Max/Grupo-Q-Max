"use client";

import { useEffect, useState } from "react";
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
  ShieldCheck,
} from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
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
  const [date, setDate] = useState<string>(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    return today;
  });

  async function fetchAgenda(isManual = false) {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/agenda?date=${date}`);
      if (!res.ok) throw new Error("Erro ao buscar agenda");
      const data = await res.json();
      setMeetings(Array.isArray(data) ? data : []);
      if (isManual) {
        toast.success("Agenda sincronizada com sucesso!");
      }
    } catch (err) {
      toast.error("Erro ao carregar a agenda comercial.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, date]);

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

      toast.success(status === "COMPLETED" ? "Reunião concluída com sucesso!" : "Visitante marcado como ausente (No-Show).");
      fetchAgenda(true);
    } catch (err) {
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

  // Filtragem ativa
  const filteredMeetings = meetings.filter((m) => {
    if (filterSource === "FINORA") return m.source !== "MICROSOFT_365";
    if (filterSource === "MICROSOFT") return m.source === "MICROSOFT_365";
    return true;
  });

  // Atalhos rápidos de data para conveniência
  const quickDates = [
    { label: "Hoje", val: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) },
    { label: "19/11", val: "2026-11-19" },
    { label: "20/11", val: "2026-11-20" },
    { label: "21/11", val: "2026-11-21" },
  ];

  return (
    <div className="space-y-6">
      {/* Barra de Controle de Data e Sincronização */}
      <div className="bg-surface border border-line p-5 rounded-3xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] text-finora-600 flex items-center justify-center shrink-0">
              <CalendarClock size={20} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-surface border border-line rounded-xl px-4 py-2 text-text text-sm font-medium focus:border-finora-600 focus:ring-2 focus:ring-finora-600/20 outline-none transition-all cursor-pointer"
              />
              <button
                type="button"
                onClick={() => fetchAgenda(true)}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface border border-line hover:border-finora-600 text-text-2 hover:text-finora-600 text-xs font-bold transition-all disabled:opacity-50"
                title="Sincronizar em tempo real com Microsoft 365"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin text-finora-600" : ""} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>

            {/* Chips de data rápida */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-line">
              {quickDates.map((qd) => (
                <button
                  key={qd.val}
                  type="button"
                  onClick={() => setDate(qd.val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    date === qd.val
                      ? "bg-finora-600 text-white shadow-xs"
                      : "bg-[#F3F4F6] text-text-2 hover:bg-[#E5E7EB] hover:text-text"
                  }`}
                >
                  {qd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <div className="bg-[#F8FAFC] border border-line rounded-2xl px-3.5 py-2 text-center">
              <span className="block text-[10px] uppercase text-text-2 font-bold tracking-wider">Total</span>
              <strong className="text-lg text-text font-mono font-bold">{totalItems}</strong>
            </div>
            <div className="bg-[#E6F0FF]/60 border border-[#B9D4F7] rounded-2xl px-3.5 py-2 text-center">
              <span className="block text-[10px] uppercase text-finora-600 font-bold tracking-wider">Finora VIP</span>
              <strong className="text-lg text-finora-600 font-mono font-bold">{waitingCount}</strong>
            </div>
            <div className="bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl px-3.5 py-2 text-center">
              <span className="block text-[10px] uppercase text-[#6366F1] font-bold tracking-wider">Teams/Outlook</span>
              <strong className="text-lg text-[#6366F1] font-mono font-bold">{microsoftMeetings.length}</strong>
            </div>
            <div className="bg-[#E3F6EA]/60 border border-[#B7E4C7] rounded-2xl px-3.5 py-2 text-center">
              <span className="block text-[10px] uppercase text-[#0F7A3D] font-bold tracking-wider">Concluídas</span>
              <strong className="text-lg text-[#0F7A3D] font-mono font-bold">{completedCount}</strong>
            </div>
          </div>
        </div>

        {/* Abas de Filtro de Origem */}
        <div className="flex items-center justify-between pt-3 border-t border-line">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterSource("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterSource === "ALL"
                  ? "bg-text text-white shadow-xs"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              Todos os Compromissos ({totalItems})
            </button>
            <button
              type="button"
              onClick={() => setFilterSource("FINORA")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterSource === "FINORA"
                  ? "bg-finora-600 text-white shadow-xs"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              <Sparkles size={12} />
              <span>Consultorias Finora ({finoraMeetings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterSource("MICROSOFT")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterSource === "MICROSOFT"
                  ? "bg-[#6366F1] text-white shadow-xs"
                  : "bg-surface border border-line text-text-2 hover:text-text"
              }`}
            >
              <Calendar size={12} />
              <span>Microsoft 365 / Hugo ({microsoftMeetings.length})</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-text-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sincronização Ativa em Tempo Real</span>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal / Grid de Reuniões */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-line rounded-3xl">
          <LoaderCircle size={40} className="animate-spin text-finora-600 mb-4" />
          <span className="text-text font-bold text-sm">Sincronizando com a agenda do Hugo e banco de dados...</span>
          <span className="text-text-2 text-xs mt-1">Consultando Microsoft Graph API em tempo real</span>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <CalendarClock size={48} className="text-text-2 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text">Nenhum compromisso para este dia</h3>
          <p className="text-text-2 text-sm mt-1 max-w-md mx-auto">
            {filterSource === "ALL"
              ? "Nenhum agendamento do site ou compromisso no calendário da Microsoft encontrado para esta data."
              : filterSource === "FINORA"
              ? "Nenhum mentorado agendou consultoria VIP do estande nesta data."
              : "Hugo não possui reuniões agendadas no Microsoft 365 para esta data."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMeetings.map((item) => {
            const isMs = item.source === "MICROSOFT_365";

            // Se for compromisso do Microsoft 365 (Hugo)
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
                  className="bg-gradient-to-br from-[#FAF5FF] via-surface to-[#F5F3FF] border border-[#DDD6FE] rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-md relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#6366F1] to-[#A855F7]" />

                  <div>
                    {/* Header: Horário & Badge de Origem */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E9D5FF]/60">
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

                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EDE9FE] text-[#6D28D9] text-[10px] font-bold uppercase tracking-wide border border-[#DDD6FE]">
                        <Calendar size={11} />
                        <span>Outlook / Teams</span>
                      </span>
                    </div>

                    {/* Assunto e Detalhes */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C3AED]">
                          Agenda Hugo Werninghaus
                        </span>
                        <h4 className="text-base font-bold text-text leading-snug mt-0.5" title={item.subject}>
                          {item.subject || "Reunião no Calendário Microsoft"}
                        </h4>
                      </div>

                      {item.location && (
                        <div className="flex items-center gap-2 text-xs text-text-2 bg-white/70 px-3 py-1.5 rounded-xl border border-[#E9D5FF]/40">
                          <MapPin size={14} className="text-[#7C3AED] shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}

                      {item.organizerName && item.organizerName !== "Hugo Werninghaus" && (
                        <div className="flex items-center gap-2 text-xs text-text-2">
                          <UserRound size={14} className="text-text-2 shrink-0" />
                          <span>Organizado por: <strong>{item.organizerName}</strong></span>
                        </div>
                      )}

                      {/* Status de resposta da Microsoft */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-text-2">Status:</span>
                        {item.msResponse === "organizer" && (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Organizador (Hugo)
                          </span>
                        )}
                        {item.msResponse === "accepted" && (
                          <span className="text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            Aceito no Calendário
                          </span>
                        )}
                        {item.msResponse === "tentative" && (
                          <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Provisório
                          </span>
                        )}
                        {item.msResponse === "notResponded" && (
                          <span className="text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                            Pendente de Aceite
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações / Link do Teams */}
                  <div className="mt-6 pt-4 border-t border-[#E9D5FF]/60 flex items-center justify-between gap-2">
                    {item.teamsUrl ? (
                      <a
                        href={item.teamsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2.5 px-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Video size={14} />
                        <span>Entrar no Microsoft Teams</span>
                        <ExternalLink size={12} className="opacity-70" />
                      </a>
                    ) : (
                      <div className="w-full py-2 px-3 rounded-xl bg-white/60 border border-[#E9D5FF] text-text-2 text-xs text-center font-medium">
                        Compromisso Bloqueado no Site 🔒
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Se for agendamento do site (Finora Experience)
            const meeting = item;
            const isHotLead = meeting.participants.chairs_count && meeting.participants.chairs_count >= 6;

            return (
              <div
                key={meeting.id}
                className={`border rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                  isHotLead
                    ? "bg-[#FFF9EE] border-[#F2D19B]"
                    : meeting.status === "SCHEDULED"
                    ? "bg-surface border-[#B9D4F7]"
                    : meeting.status === "COMPLETED"
                    ? "bg-[#E3F6EA]/70 border-[#B7E4C7]"
                    : "bg-[#FDE8EC]/70 border-[#F5C2CD] opacity-75"
                }`}
              >
                {isHotLead && (
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-amber-600" />
                )}

                <div>
                  {/* Header: Time & Status */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-text font-mono">
                        {format(new Date(meeting.scheduled_at), "HH:mm", { locale: ptBR })}
                      </span>
                      <span className="text-[11px] text-text-2 font-medium">
                        (45 min)
                      </span>
                    </div>

                    {meeting.status === "SCHEDULED" && isHotLead && (
                      <span className="px-2.5 py-1 rounded-full bg-[#FFF3DC] text-[#8A4B00] text-[10px] font-bold uppercase border border-[#F2D19B] flex items-center gap-1 shadow-xs">
                        🔥 Lead Quente ({meeting.participants.chairs_count} cad.)
                      </span>
                    )}
                    {meeting.status === "SCHEDULED" && !isHotLead && (
                      <span className="px-2.5 py-1 rounded-full bg-[#E6F0FF] text-finora-600 text-[10px] font-bold uppercase border border-[#B9D4F7]">
                        Aguardando
                      </span>
                    )}
                    {meeting.status === "COMPLETED" && (
                      <span className="px-2.5 py-1 rounded-full bg-[#E3F6EA] text-[#0F7A3D] text-[10px] font-bold uppercase flex items-center gap-1 border border-[#B7E4C7]">
                        <UserCheck size={12} /> Concluída
                      </span>
                    )}
                    {meeting.status === "NO_SHOW" && (
                      <span className="px-2.5 py-1 rounded-full bg-[#FDE8EC] text-[#A3112F] text-[10px] font-bold uppercase flex items-center gap-1 border border-[#F5C2CD]">
                        <UserX size={12} /> Faltou
                      </span>
                    )}
                  </div>

                  {/* Body: Lead Details */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#E6F0FF] text-finora-600 flex items-center justify-center shrink-0 mt-0.5">
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
                        const msg = `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora no Summit Clinicorp. Confirmando nossa consultoria VIP de diagnóstico financeiro hoje às ${timeStr} com nosso executivo. Já estamos te esperando no estande! 🚀`;
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
                  <div className="mt-6 pt-4 border-t border-line flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateStatus(meeting.id, "COMPLETED")}
                      className="flex-1 py-2.5 rounded-xl bg-[#E3F6EA] hover:bg-[#D2EFDC] border border-[#B7E4C7] text-[#0F7A3D] text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <UserCheck size={16} />
                      <span>Concluída</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(meeting.id, "NO_SHOW")}
                      className="flex-1 py-2.5 rounded-xl bg-[#FDE8EC] hover:bg-[#FAD4DC] border border-[#F5C2CD] text-[#A3112F] text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <UserX size={16} />
                      <span>Faltou</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 pt-3 border-t border-line text-center text-xs text-text-2 font-medium">
                    Atendimento registrado
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
