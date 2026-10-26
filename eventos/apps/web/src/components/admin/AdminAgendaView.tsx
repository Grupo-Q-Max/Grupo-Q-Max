"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, CalendarClock, UserCheck, UserX, Phone, Mail, Building2, UserRound, ArrowRight, MessageSquare } from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type AgendaMeeting = {
  id: number;
  scheduled_at: string;
  status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
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
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);

  async function fetchAgenda() {
    setLoading(true);
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/event/${eventId}/agenda?date=${date}`);
      if (!res.ok) throw new Error("Erro ao buscar agenda");
      const data = await res.json();
      setMeetings(data);
    } catch (err) {
      toast.error("Erro ao carregar a agenda comercial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgenda();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, date]);

  async function updateStatus(meetingId: number, status: "COMPLETED" | "NO_SHOW") {
    try {
      const proxyUrl = getAdminProxyUrl();
      const res = await fetch(`${proxyUrl}/meetings/${meetingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar status");
      
      toast.success(status === "COMPLETED" ? "Reunião concluída com sucesso!" : "Visitante marcado como ausente (No-Show).");
      fetchAgenda(); // Recarrega
    } catch (err) {
      toast.error("Erro ao atualizar o status da reunião.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Date Picker & Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface border border-line p-4 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E6F0FF] text-finora-600 flex items-center justify-center">
            <CalendarClock size={20} />
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-surface border border-line rounded-xl px-4 py-2 text-text text-sm focus:border-finora-600 outline-none"
          />
        </div>

        <div className="flex gap-4">
          <div className="text-center px-4">
            <span className="block text-[10px] uppercase text-text-2 font-bold tracking-wider">Agendados</span>
            <strong className="text-xl text-text">{meetings.filter(m => m.status === "SCHEDULED").length}</strong>
          </div>
          <div className="text-center px-4 border-l border-line">
            <span className="block text-[10px] uppercase text-[#0F7A3D] font-bold tracking-wider">Concluídas</span>
            <strong className="text-xl text-[#0F7A3D]">{meetings.filter(m => m.status === "COMPLETED").length}</strong>
          </div>
          <div className="text-center px-4 border-l border-line">
            <span className="block text-[10px] uppercase text-[#A3112F] font-bold tracking-wider">No-Show</span>
            <strong className="text-xl text-[#A3112F]">{meetings.filter(m => m.status === "NO_SHOW").length}</strong>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <LoaderCircle size={40} className="animate-spin text-finora-600 mb-4" />
          <span className="text-text-2 text-sm">Carregando horários...</span>
        </div>
      ) : meetings.length === 0 ? (
        <div className="bg-surface border border-line rounded-3xl p-12 text-center">
          <CalendarClock size={48} className="text-text-2 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-text">Nenhum agendamento para este dia</h3>
          <p className="text-text-2 text-sm mt-1">Os agendamentos aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting) => (
            <div 
              key={meeting.id} 
              className={`border rounded-3xl p-6 transition-all hover:-translate-y-1 relative overflow-hidden ${
                meeting.participants.chairs_count && meeting.participants.chairs_count >= 6
                  ? "bg-[#FFF3DC] border-[#F2D19B]"
                  : meeting.status === "SCHEDULED" ? "bg-surface border-[#B9D4F7]" :
                    meeting.status === "COMPLETED" ? "bg-[#E3F6EA] border-[#B7E4C7]" :
                    "bg-[#FDE8EC] border-[#F5C2CD] opacity-70"
              }`}
            >
              {meeting.participants.chairs_count && meeting.participants.chairs_count >= 6 && (
                <div className="absolute top-0 left-0 w-full h-1 bg-warning" />
              )}
              {/* Header: Time & Status */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-line">
                <span className="text-2xl font-black text-text font-mono">
                  {format(new Date(meeting.scheduled_at), "HH:mm", { locale: ptBR })}
                </span>
                
                {meeting.status === "SCHEDULED" && meeting.participants.chairs_count && meeting.participants.chairs_count >= 6 && (
                  <span className="px-2 py-1 rounded-md bg-[#FFF3DC] text-[#8A4B00] text-[10px] font-bold uppercase border border-[#F2D19B]">
                    🔥 Lead Quente
                  </span>
                )}
                {meeting.status === "SCHEDULED" && (!meeting.participants.chairs_count || meeting.participants.chairs_count < 6) && (
                  <span className="px-2 py-1 rounded-md bg-[#E6F0FF] text-finora-600 text-[10px] font-bold uppercase">
                    Aguardando
                  </span>
                )}
                {meeting.status === "COMPLETED" && (
                  <span className="px-2 py-1 rounded-md bg-[#E3F6EA] text-[#0F7A3D] text-[10px] font-bold uppercase flex items-center gap-1">
                    <UserCheck size={12} /> Concluída
                  </span>
                )}
                {meeting.status === "NO_SHOW" && (
                  <span className="px-2 py-1 rounded-md bg-[#FDE8EC] text-[#A3112F] text-[10px] font-bold uppercase flex items-center gap-1">
                    <UserX size={12} /> Faltou
                  </span>
                )}
              </div>

              {/* Body: Lead Details */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <UserRound size={16} className="text-text-2 mt-0.5 shrink-0" />
                  <div>
                    <strong className="text-base text-text block">{meeting.participants.full_name}</strong>
                    <span className="text-xs text-text-2">ID #{meeting.participants.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-text-2 shrink-0" />
                  <span className="text-sm text-text truncate" title={meeting.participants.email}>
                    {meeting.participants.email}
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
                    const msg = `Olá Dr(a). ${firstName}! Tudo bem? Aqui é da equipe Finora no Summit Clinicorp. Confirmando nossa consultoria VIP de diagnóstico financeiro hoje às ${timeStr} no nosso estande. Já estamos te esperando! 🚀`;
                    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#E3F6EA] hover:bg-[#25D366] text-[#0F7A3D] hover:text-white transition-all text-xs font-bold shadow-xs active:scale-95"
                        title="Chamar no WhatsApp Web para confirmar reunião"
                      >
                        <MessageSquare size={13} />
                        <span>Zap</span>
                      </a>
                    );
                  })()}
                </div>

                <div className="flex items-start gap-3">
                  <Building2 size={16} className="text-text-2 mt-0.5 shrink-0" />
                  <div className="text-sm text-text">
                    <span className="block">{meeting.participants.clinic_name || "Clínica não informada"}</span>
                    {meeting.participants.cro_number && (
                      <span className="text-xs text-text-2">CRO: {meeting.participants.cro_number}/{meeting.participants.cro_state}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {meeting.status === "SCHEDULED" && (
                <div className="mt-6 pt-4 border-t border-line flex gap-2">
                  <button
                    onClick={() => updateStatus(meeting.id, "COMPLETED")}
                    className="flex-1 py-2.5 rounded-xl bg-[#E3F6EA] hover:bg-[#D2EFDC] border border-[#B7E4C7] text-[#0F7A3D] text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <UserCheck size={16} />
                    <span>Concluída</span>
                  </button>
                  <button
                    onClick={() => updateStatus(meeting.id, "NO_SHOW")}
                    className="flex-1 py-2.5 rounded-xl bg-[#FDE8EC] hover:bg-[#FAD4DC] border border-[#F5C2CD] text-[#A3112F] text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <UserX size={16} />
                    <span>Faltou</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
