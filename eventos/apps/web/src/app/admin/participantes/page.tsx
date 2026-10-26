import { Download } from "lucide-react";
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

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className={adminMain}>
        <AdminHeader
          eyebrow="Operação"
          title="Participantes"
          description="Consulte cadastros, participações, premiações e verificações antifraude."
        >
            {canExport && (<>
            <a
              href={`/finora-experience/api/admin-proxy/participants/event/${eventId}/export-csv`}
              download={`leads-evento-${eventId}.csv`}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
            >
              <Download size={14} className="text-[#00E5FF]" />
              <span>Exportar CSV Geral</span>
            </a>

            <a
              href={`/finora-experience/api/admin-proxy/participants/event/${eventId}/export-crm-csv`}
              download={`leads-crm-rdstation-evento-${eventId}.csv`}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-finora-600 to-[#00E5FF] px-4.5 py-2 text-xs font-bold text-white shadow-[0_0_15px_rgba(34,195,220,0.3)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Download size={14} className="text-white" />
              <span>Exportar CRM (RD Station / HubSpot)</span>
            </a>
            </>)}

            <EventSelector
              events={events}
              currentEventId={eventId}
            />
        </AdminHeader>


        <section className="grid grid-cols-[minmax(0,1fr)_150px] gap-2.5 max-sm:grid-cols-1 [&>div]:rounded-[18px] [&>div]:border [&>div]:border-line [&>div]:bg-surface [&>div]:px-4 [&>div]:py-3 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-base">
          <div>
            <span>
              Evento atual
            </span>

            <strong>
              {currentEvent?.name ||
                "Evento"}
            </strong>
          </div>

          <div>
            <span>
              Participações
            </span>

            <strong>
              {participations.length}
            </strong>
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
