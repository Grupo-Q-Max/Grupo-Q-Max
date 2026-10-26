import AdminSidebar from "@/components/admin/AdminSidebar";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  ArrowRight,
  Trophy,
  PackageCheck,
  Radio,
  Tv,
  Sparkles,
  Layers,
  PauseCircle,
  Archive,
} from "lucide-react";
import { getEvents } from "@/lib/api";

import EventCreateControl from "@/components/admin/EventCreateControl";
import EventEditControl from "@/components/admin/EventEditControl";
import EventDeleteControl from "@/components/admin/EventDeleteControl";

function getStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#E3F6EA] text-[#0F7A3D] border border-[#B7E4C7] flex items-center gap-1.5">
          <CheckCircle2 size={13} />
          ATIVO
        </span>
      );
    case "PAUSED":
      return (
        <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#FFF3DC] text-[#8A4B00] border border-[#F2D19B] flex items-center gap-1.5">
          <PauseCircle size={13} />
          PAUSADO
        </span>
      );
    case "CLOSED":
    case "ARCHIVED":
      return (
        <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#EEF1F5] text-text-2 border border-line-strong flex items-center gap-1.5">
          <Archive size={13} />
          ENCERRADO
        </span>
      );
    default:
      return (
        <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#EEF1F5] text-text-2 border border-line-strong flex items-center gap-1.5">
          RASCUNHO
        </span>
      );
  }
}

export default async function EventosPage() {
  const events = await getEvents();
  const eventList = Array.isArray(events) ? events : [];

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 space-y-6 max-w-6xl w-full mx-auto">
          {/* Banner de Topo */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-line p-6 rounded-3xl backdrop-blur mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
              <CalendarDays size={160} />
            </div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black text-finora-600 uppercase tracking-widest">
                  GESTÃO DO SISTEMA • EVENTOS CORPORATIVOS
                </span>
              </div>
              <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] mb-1">
                Eventos Cadastrados
              </h1>
              <p className="text-xs text-text-2 max-w-xl leading-relaxed">
                Painel central para criar, editar e excluir feiras, estandes e congressos ativos na plataforma.
              </p>
            </div>

            <div className="flex items-center gap-3 relative z-10">
              <div className="hidden sm:flex items-center gap-2 bg-paper border border-line px-4 py-2.5 rounded-2xl text-xs font-bold text-text">
                <Layers size={16} className="text-finora-600" />
                <span>{eventList.length} Cadastrados</span>
              </div>
              <EventCreateControl />
            </div>
          </div>

          {/* Grid de Eventos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {eventList.length > 0 ? (
              eventList.map((event: any) => (
                <div
                  key={event.id}
                  className="bg-surface border border-line hover:border-[#B9D4F7] p-6 rounded-3xl backdrop-blur transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      {getStatusBadge(event.status)}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-text-2 bg-paper px-2.5 py-1 rounded-lg border border-line">
                          ID #{event.id}
                        </span>
                        
                        {/* CRUD Controls Dropdown ou Inline */}
                        <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <EventEditControl event={event} />
                          <EventDeleteControl eventId={event.id} eventName={event.name} />
                        </div>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-text mb-2 line-clamp-1">
                      {event.name}
                    </h3>
                    <p className="text-sm text-text-2 leading-relaxed mb-6 line-clamp-2 min-h-[40px]">
                      {event.description || "Nenhuma descrição fornecida para este evento."}
                    </p>

                    {/* Atalhos Rápidos por Evento */}
                    <div className="grid grid-cols-3 gap-2 mb-6 bg-paper p-2 rounded-2xl border border-line">
                      <Link
                        href={`/${event.slug}/roleta?eventId=${event.id}`}
                        className="bg-surface hover:bg-[#EEF1F5] p-2.5 rounded-xl border border-line text-center flex flex-col items-center gap-1.5 transition-colors group/link"
                      >
                        <Sparkles size={16} className="text-finora-600 group-hover/link:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-text-2 group-hover/link:text-text">Roleta</span>
                      </Link>

                      <Link
                        href={`/admin/balcao?event=${event.id}`}
                        className="bg-surface hover:bg-[#EEF1F5] p-2.5 rounded-xl border border-line text-center flex flex-col items-center gap-1.5 transition-colors group/link"
                      >
                        <PackageCheck size={16} className="text-finora-600 group-hover/link:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-text-2 group-hover/link:text-text">Balcão</span>
                      </Link>

                      <Link
                        href={`/${event.slug}/telao`}
                        className="bg-surface hover:bg-[#EEF1F5] p-2.5 rounded-xl border border-line text-center flex flex-col items-center gap-1.5 transition-colors group/link"
                      >
                        <Tv size={16} className="text-finora-600 group-hover/link:scale-110 transition-transform" />
                        <span className="text-[10px] font-bold text-text-2 group-hover/link:text-text">Telão TV</span>
                      </Link>
                    </div>
                  </div>

                  {/* Ação Principal */}
                  <div className="pt-5 border-t border-line flex items-center justify-between gap-3">
                    <Link
                      href={`/admin/dashboard?event=${event.id}`}
                      className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-full bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all border border-[#B9D4F7]"
                    >
                      <span>Gerenciar Dashboard</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href={`/admin/relatorios?event=${event.id}`}
                      className="p-3 rounded-xl bg-[#EEF1F5] hover:bg-line-strong text-text border border-line-strong transition-all"
                      title="Ver Relatório de Desempenho"
                    >
                      <Trophy size={18} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-20 flex flex-col items-center justify-center text-center text-text-2 bg-surface border border-dashed border-line rounded-3xl">
                <CalendarDays size={48} className="text-text-2 mb-4" />
                <strong className="text-lg text-text mb-1">Nenhum evento encontrado</strong>
                <p className="text-sm">Clique em "Novo Evento" para começar.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
