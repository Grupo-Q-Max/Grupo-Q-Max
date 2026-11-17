import { Download, FileSpreadsheet, Flame } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import { AdminHeader, adminMain } from "@/components/form/Paper";
import ParticipantsManager from "@/components/participants/ParticipantsManager";
import { getEvents, getParticipants } from "@/lib/api";
import { canExportParticipants } from "@/lib/admin-access";
import { getAdminRole } from "@/lib/admin-role";

type PageProps = {
  searchParams: Promise<{
    event?: string;
  }>;
};

export default async function ParticipantsPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const events =
    await getEvents();

  const canExport = canExportParticipants(await getAdminRole());

  if (
    !Array.isArray(events) ||
    events.length === 0
  ) {
    throw new Error(
      "Nenhum evento cadastrado.",
    );
  }

  const requestedId =
    Number(params.event);

  const exists =
    events.some(
      (event: { id: number }) =>
        event.id === requestedId,
    );

  const eventId =
    exists
      ? requestedId
      : events[0].id;

  const participations =
    await getParticipants(
      eventId,
    );

  const currentEvent =
    events.find(
      (event: { id: number }) =>
        event.id === eventId,
    );

  const crmSynced = Array.isArray(participations)
    ? participations.filter((p: { crm_sent_at?: string | null }) => Boolean(p.crm_sent_at)).length
    : 0;
  const crmPending = Math.max(0, (participations?.length || 0) - crmSynced);

  // Segmentação comercial para o cabeçalho
  const hotCount = Array.isArray(participations)
    ? participations.filter((p: any) => {
        const hasMeeting = p.participants?.meetings?.some(
          (m: any) => m.status === 'SCHEDULED' || m.status === 'COMPLETED'
        );
        const hasClaimed = Boolean(p.draws?.[0]?.claimed_at);
        return hasMeeting || hasClaimed;
      }).length
    : 0;

  const warmCount = Array.isArray(participations)
    ? participations.filter((p: any) => {
        const hasMeeting = p.participants?.meetings?.some(
          (m: any) => m.status === 'SCHEDULED' || m.status === 'COMPLETED'
        );
        const hasClaimed = Boolean(p.draws?.[0]?.claimed_at);
        const isHot = hasMeeting || hasClaimed;
        const isVip = Boolean(p.vip_codes) || (p.participants?.chairs_count && p.participants.chairs_count >= 6);
        return !isHot && isVip;
      }).length
    : 0;

  const generalCount = Math.max(0, (participations?.length || 0) - hotCount - warmCount);

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className={adminMain}>
        <AdminHeader
          eyebrow="Operação"
          title="Participantes"
          description="Consulte cadastros, participações, premiações e exporte planilhas comerciais segmentadas."
        >
            {canExport && (<>
            <a
              href={`/finora-experience/api/admin-proxy/participants/event/${eventId}/export-commercial-csv`}
              download={`leads-comercial-segmentado-evento-${eventId}.csv`}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 via-teal-600 to-[#00E5FF] px-4.5 py-2 text-xs font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all hover:brightness-110 active:scale-[0.98]"
              title="Baixar planilha organizada com prioridades (Quentes/Mornos/Gerais), links de WhatsApp com 1 clique e mensagens sugeridas"
            >
              <FileSpreadsheet size={15} className="text-white" />
              <span>Exportar Comercial (1-Clique)</span>
            </a>

            <a
              href={`/finora-experience/api/admin-proxy/participants/event/${eventId}/export-crm-csv`}
              download={`leads-crm-rdstation-evento-${eventId}.csv`}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              <Download size={14} className="text-[#00E5FF]" />
              <span>CRM (RD Station)</span>
            </a>

            <a
              href={`/finora-experience/api/admin-proxy/participants/event/${eventId}/export-csv`}
              download={`leads-evento-${eventId}.csv`}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-2 text-xs font-medium text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white"
            >
              <Download size={13} className="text-slate-400" />
              <span>CSV Geral</span>
            </a>
            </>)}

            <EventSelector
              events={events}
              currentEventId={eventId}
            />
        </AdminHeader>

        {/* Painel de Segmentação Comercial 1-Clique */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 [&>div]:rounded-[18px] [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:p-4 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-lg">
          <div>
            <span className="text-slate-400 font-medium">Total de Participações</span>
            <strong className="text-white font-extrabold">{participations.length} leads</strong>
            <span className="text-[11px] text-slate-400 mt-1">Evento: {currentEvent?.name || "Evento"}</span>
          </div>

          <div className="border-emerald-500/30 bg-emerald-950/20">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
              🟢 Leads Quentes
            </span>
            <strong className="text-emerald-300 font-extrabold">{hotCount} prontos</strong>
            <span className="text-[11px] text-emerald-400/80 mt-1">Reunião agendada ou no estande</span>
          </div>

          <div className="border-amber-500/30 bg-amber-950/20">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="size-2.5 rounded-full bg-amber-400" />
              🟡 Leads Mornos
            </span>
            <strong className="text-amber-300 font-extrabold">{warmCount} qualificados</strong>
            <span className="text-[11px] text-amber-400/80 mt-1">VIP / Mentorado sem reunião</span>
          </div>

          <div className="border-blue-500/30 bg-blue-950/20">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold">
              <span className="size-2.5 rounded-full bg-blue-400" />
              ⚪ Leads Gerais
            </span>
            <strong className="text-blue-300 font-extrabold">{generalCount} visitantes</strong>
            <span className="text-[11px] text-blue-400/80 mt-1">Base ampla para nutrição</span>
          </div>
        </section>

        <ParticipantsManager
          participations={
            participations
          }
          canExport={canExport}
        />
      </main>
    </div>
  );
}
