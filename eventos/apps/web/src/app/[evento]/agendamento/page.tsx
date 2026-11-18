import VipScheduler from "@/components/VipScheduler";
import { PaperShell } from "@/components/form/Paper";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";
import AgendamentoLookupClient from "./AgendamentoLookupClient";

type Props = {
  params: Promise<{ evento: string }>;
  searchParams: Promise<{ event?: string; id?: string; participant?: string; pin?: string }>;
};

export default async function EventAgendamentoRootPage({ params, searchParams }: Props) {
  const { evento } = await params;
  const query = await searchParams;
  const event = await getEventByRoute(evento);
  const participantId = Number(query.id || query.participant || query.pin || 0);

  return (
    <PaperShell event={eventThemeOf(event, evento)} backHref={`/${evento}`}>
      {participantId > 0 ? (
        <VipScheduler eventId={Number(query.event) || event.id} participantId={participantId} />
      ) : (
        <AgendamentoLookupClient eventId={Number(query.event) || event.id} eventSlug={evento} />
      )}
    </PaperShell>
  );
}
