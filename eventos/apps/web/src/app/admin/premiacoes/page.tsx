import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import AdminPremiacoesView from "@/components/admin/AdminPremiacoesView";
import { getEvents } from "@/lib/api";

type Props = {
  searchParams: Promise<{ event?: string }>;
};

export default async function AdminPremiacoesPage({ searchParams }: Props) {
  const params = await searchParams;
  const events = await getEvents();
  const requestedEventId = Number(params.event);
  const eventId = events.some((event: { id: number }) => event.id === requestedEventId)
    ? requestedEventId
    : (events.find((e: { slug: string; id: number }) => e.slug === "invictus")?.id || events[0]?.id || 3);

  return (
    <div className="adminShell">
      <AdminSidebar />
      <main className="adminMain adminPaper bg-paper text-text flex-1 min-w-0 overflow-hidden p-6 md:p-10 lg:p-14 relative z-0">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-finora-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto space-y-10">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-line">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-widest rounded-lg">
                  Gestão de Ganhadores · Roleta 1 & Roleta VIP
                </span>
              </div>
              <h1 className="font-display text-[30px] font-bold tracking-[-0.02em]">
                Premiações dos Participantes
              </h1>
              <p className="text-text-2 mt-2 text-sm max-w-xl">
                Consulte tudo o que cada participante ganhou nas roletas e adicione ou edite manualmente qualquer brinde ou recompensa VIP que não tenha sido salvo.
              </p>
            </div>

            <div className="shrink-0 w-full md:w-64">
              <EventSelector events={events} currentEventId={eventId} />
            </div>
          </header>

          <AdminPremiacoesView eventId={eventId} />
        </div>
      </main>
    </div>
  );
}
