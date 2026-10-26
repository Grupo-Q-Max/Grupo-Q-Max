import ClinicorpRegistrationForm from "@/components/clinicorp/ClinicorpRegistrationForm";
import SucessoOdontoRegistrationForm from "@/components/SucessoOdontoRegistrationForm";
import { PaperShell } from "@/components/form/Paper";
import { eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

type Props = {
  params: Promise<{ evento: string }>;
  searchParams: Promise<{ vip?: string }>;
};

export default async function EventCadastroPage({ params, searchParams }: Props) {
  const { evento } = await params;
  const { vip } = await searchParams;
  const event = await getEventByRoute(evento);
  const theme = eventThemeOf(event, evento);

  return (
    <PaperShell event={theme} backHref={`/${evento}`}>
      {event.experience === "COFRE" ? (
        <SucessoOdontoRegistrationForm eventId={event.id} eventName={event.name} route={evento} initialVipCode={vip} />
      ) : (
        <ClinicorpRegistrationForm eventId={event.id} eventName={event.name} initialVipCode={vip} route={evento} />
      )}
    </PaperShell>
  );
}
