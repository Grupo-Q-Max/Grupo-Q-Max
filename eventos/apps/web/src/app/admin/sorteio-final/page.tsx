import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import GrandDrawExperience from "@/components/admin/GrandDrawExperience";
import { AdminHeader, adminMain, ui } from "@/components/form/Paper";
import { getEligibleGrandDraw, getEvents } from "@/lib/api";
import { eventStyle, eventThemeOf } from "@/components/brand/Brand";

type PageProps = {
  searchParams: Promise<{ event?: string }>;
};

export default async function GrandDrawAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await getEvents().catch(() => []);

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Nenhum evento cadastrado.");
  }

  const requestedId = Number(params.event);
  const event = events.find((e: { id: number }) => e.id === requestedId) || events[0];
  const eligible = await getEligibleGrandDraw(event.id).catch(() => []);
  const eventSlug = event.slug;

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className={adminMain} data-event={eventSlug} style={eventStyle(eventThemeOf(event))}>
        <AdminHeader
          eyebrow="Sorteio"
          title="Sorteio Geral"
          description="Sorteie o grande prêmio entre os cupons elegíveis. Para projetar, abra a versão do telão."
        >
          <div className="rounded-[10px] bg-surface">
            <EventSelector events={events} currentEventId={event.id} />
          </div>
          <a
            href={`/finora-experience/${eventSlug}/sorteio-geral?event=${event.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ui.pill}
          >
            Abrir no telão
          </a>
        </AdminHeader>

        {/* O sorteio em si fica no Palco: é o que aparece para o público. */}
        <section className="overflow-hidden rounded-card bg-ink-950 text-ink-text select-none">
          <GrandDrawExperience
            eventId={event.id}
            eventName={event.name}
            initialParticipants={Array.isArray(eligible) ? eligible : []}
          />
        </section>
      </main>
    </div>
  );
}
