import GrandDrawExperience from "@/components/admin/GrandDrawExperience";
import SorteioEventSelector from "@/components/admin/SorteioEventSelector";
import { getEvents, getEligibleGrandDraw } from "@/lib/api";

// Página do Sorteio Geral nas rotas de evento (Palco).
export default async function GrandDrawPage({ requestedEvent }: { requestedEvent?: string }) {
  const events = await getEvents().catch(() => []);

  if (!Array.isArray(events) || events.length === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink-950 p-6 text-center text-ink-text">
        <h1 className="font-display text-4xl font-bold">Nenhum evento ativo</h1>
        <p className="text-ink-text-2">Cadastre ou ative um evento no admin para fazer o Sorteio Geral.</p>
      </main>
    );
  }

  const requestedEventId = requestedEvent ? Number(requestedEvent) : NaN;
  const selectedEvent = events.find((e: { id: number }) => e.id === requestedEventId) || events[0];
  const eligible = await getEligibleGrandDraw(selectedEvent.id).catch(() => []);

  return (
    <main className="min-h-dvh w-full bg-ink-950 text-ink-text select-none">
      <GrandDrawExperience
        eventId={selectedEvent.id}
        eventName={selectedEvent.name}
        initialParticipants={Array.isArray(eligible) ? eligible : []}
      />
      <footer className="flex items-center gap-3 px-6 pb-8 text-ink-text-2 lg:px-12">
        Evento:
        <span className="rounded-xl border border-ink-line px-3 py-2">
          <SorteioEventSelector events={events} currentEventId={selectedEvent.id} />
        </span>
      </footer>
    </main>
  );
}
