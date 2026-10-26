import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import { AdminHeader, adminMain } from "@/components/form/Paper";
import QueueManager from "@/components/queue/QueueManager";
import { getEvents, getQueue, getPrizes } from "@/lib/api";



type PageProps = {
  searchParams: Promise<{
    event?: string;
  }>;
};

export default async function QueuePage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const events =
    await getEvents();

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

  const [queue, prizes] =
    await Promise.all([
      getQueue(eventId),
      getPrizes(eventId),
    ]);

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className={adminMain}>
        <AdminHeader
          eyebrow="Operação"
          title="Fila de premiação"
          description="Defina de forma simples a ordem das próximas recompensas."
        >
          <EventSelector events={events} currentEventId={eventId} />
        </AdminHeader>

        <QueueManager
          eventId={eventId}
          initialQueue={queue}
          prizes={prizes}
        />
      </main>
    </div>
  );
}
