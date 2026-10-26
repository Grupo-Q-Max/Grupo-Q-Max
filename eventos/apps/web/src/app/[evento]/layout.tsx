import type { Metadata, Viewport } from "next";

import ClinicorpKioskGuard from "@/components/clinicorp/ClinicorpKioskGuard";
import { eventStyle, eventThemeOf } from "@/components/brand/Brand";
import { getEventByRoute } from "@/lib/event-route";

type Props = { params: Promise<{ evento: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEventByRoute((await params).evento);
  return {
    title: `Finora Experience | ${event.name}`,
    description: `Experiência interativa Finora no ${event.name}.`,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A1020",
};

// Rota única dos eventos: tema e experiência vêm do cadastro do evento no admin.
export default async function EventLayout({ children, params }: Props & { children: React.ReactNode }) {
  const { evento } = await params;
  const event = await getEventByRoute(evento);

  return (
    <div data-event={evento} style={eventStyle(eventThemeOf(event))}>
      <ClinicorpKioskGuard event={evento} />
      {children}
    </div>
  );
}
