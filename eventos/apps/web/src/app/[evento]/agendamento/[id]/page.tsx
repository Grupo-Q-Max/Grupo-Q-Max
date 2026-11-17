import VipScheduler from "@/components/VipScheduler";
import { PaperShell } from "@/components/form/Paper";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

type Props = {
  params: Promise<{ evento: string; id: string }>;
  searchParams: Promise<{ event?: string }>;
};

export default async function EventAgendamentoPage({ params, searchParams }: Props) {
  const { evento, id } = await params;
  const query = await searchParams;
  const event = await getEventByRoute(evento);

  return (
    <PaperShell event={eventThemeOf(event, evento)} backHref={`/${evento}`}>
      <VipScheduler eventId={Number(query.event) || event.id} token={decodeURIComponent(id)} />
    </PaperShell>
  );
}
