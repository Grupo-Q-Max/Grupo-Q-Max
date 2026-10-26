import ClinicorpRouletteExperience from "@/components/clinicorp/ClinicorpRouletteExperience";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

type Props = {
  params: Promise<{ evento: string }>;
  searchParams: Promise<{ eventId?: string }>;
};

export default async function EventRoletaPage({ params, searchParams }: Props) {
  const { evento } = await params;
  const { eventId } = await searchParams;
  const event = await getEventByRoute(evento);

  return (
    <main className="h-dvh max-h-dvh w-full overflow-hidden select-none bg-ink-950 text-ink-text">
      <ClinicorpRouletteExperience eventId={Number(eventId) || event.id} event={eventThemeOf(event, evento)} />
    </main>
  );
}
