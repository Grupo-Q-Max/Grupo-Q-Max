import AdminSidebar from "@/components/admin/AdminSidebar";
import EventSelector from "@/components/admin/EventSelector";
import VipCodesManager from "@/components/admin/VipCodesManager";
import { AdminHeader, adminMain } from "@/components/form/Paper";
import { getEvents } from "@/lib/api";

type PageProps = {
  searchParams: Promise<{ event?: string }>;
};

export default async function VipCodesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await getEvents().catch(() => []);

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error("Nenhum evento cadastrado.");
  }

  const event = events.find((e: { id: number }) => e.id === Number(params.event)) || events[0];

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className={adminMain}>
        <AdminHeader
          eyebrow="Cartões VIP & Mentorados"
          title="Códigos VIP & Bilhetes de Mentorado"
          description="Gere os códigos para impressão em cartões físicos ou envio digital com QR Code. Cada código libera a Roleta/Cofre VIP com os prêmios exclusivos de mentorados, com validação de resgate único e auditoria antifraude."
        >
          <div className="rounded-[10px] bg-surface">
            <EventSelector events={events} currentEventId={event.id} />
          </div>
        </AdminHeader>

        <VipCodesManager key={event.id} eventId={event.id} eventName={event.name} eventSlug={event.slug} />
      </main>
    </div>
  );
}
