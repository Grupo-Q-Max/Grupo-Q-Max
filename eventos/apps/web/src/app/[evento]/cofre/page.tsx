import { notFound } from "next/navigation";
import VaultExperience from "@/components/VaultExperience";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

type Props = {
  params: Promise<{ evento: string }>;
  searchParams: Promise<{ eventId?: string }>;
};

export default async function EventCofrePage({ params, searchParams }: Props) {
  const { evento } = await params;
  const { eventId } = await searchParams;
  const event = await getEventByRoute(evento);
  if (event.experience !== "COFRE") notFound();

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink-950 text-ink-text">
      <VaultExperience
        eventId={Number(eventId) || event.id}
        route={evento}
        eventName={event.name}
        event={eventThemeOf(event, evento)}
      />
    </main>
  );
}
