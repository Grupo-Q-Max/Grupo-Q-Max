import StageLanding from "@/components/stage/StageLanding";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

export default async function EventLandingPage({ params }: { params: Promise<{ evento: string }> }) {
  const { evento } = await params;
  return <StageLanding event={eventThemeOf(await getEventByRoute(evento), evento)} />;
}
