import LiveScreen from "@/components/stage/LiveScreen";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

export default async function EventTelaoPage({ params }: { params: Promise<{ evento: string }> }) {
  const { evento } = await params;
  const event = await getEventByRoute(evento);
  return <LiveScreen event={eventThemeOf(event, evento)} eventId={event.id} />;
}
