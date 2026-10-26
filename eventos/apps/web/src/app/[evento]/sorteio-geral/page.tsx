import GrandDrawPage from "@/components/stage/GrandDrawPage";
import { getEventByRoute } from "@/lib/event-route";

type Props = {
  params: Promise<{ evento: string }>;
  searchParams: Promise<{ eventId?: string; event?: string }>;
};

export default async function EventSorteioGeralPage({ params, searchParams }: Props) {
  const { evento } = await params;
  const query = await searchParams;
  const event = await getEventByRoute(evento);
  return <GrandDrawPage requestedEvent={query.eventId || query.event || String(event.id)} />;
}
