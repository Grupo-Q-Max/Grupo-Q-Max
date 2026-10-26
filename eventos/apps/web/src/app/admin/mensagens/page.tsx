import AdminSidebar from "@/components/admin/AdminSidebar";
import WhatsappTemplateManager from "@/components/admin/WhatsappTemplateManager";
import { getEvents } from "@/lib/api";

type Props = {
  searchParams: Promise<{ event?: string }>;
};

export default async function MensagensPage({ searchParams }: Props) {
  const params = await searchParams;
  const events = await getEvents();

  const requestedEventId = Number(params.event);
  const currentEvent =
    (Array.isArray(events) && events.find((e: { id: number }) => e.id === requestedEventId)) ||
    (Array.isArray(events) && events[0]) ||
    { id: 1, name: "Clinicorp" };

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text p-6 lg:p-8 flex flex-col justify-center min-h-[calc(100vh-2rem)]">
        <WhatsappTemplateManager
          eventId={currentEvent.id}
          eventName={currentEvent.name}
        />
      </main>
    </div>
  );
}
