import AdminSidebar from "@/components/admin/AdminSidebar";
import ComunicacaoDashboardClient from "@/components/admin/ComunicacaoDashboardClient";
import { getEvents } from "@/lib/api";

type Props = {
  searchParams: Promise<{ event?: string }>;
};

export default async function DisparosCampanhaPage({ searchParams }: Props) {
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

      <main className="adminMain adminPaper bg-paper text-text p-6 lg:p-8 flex flex-col min-h-screen">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.02em]">
              Acompanhamento de Disparos WhatsApp
            </h1>
            <p className="text-text-2 mt-1">
              Monitore em tempo real o envio seguro da Campanha Dr. Igor Steinmeyer e fila de mensagens.
            </p>
          </div>
        </header>

        <div className="flex-1">
          <ComunicacaoDashboardClient
            eventId={currentEvent.id}
            eventName={currentEvent.name}
          />
        </div>
      </main>
    </div>
  );
}

