// Corpo do POST enviado ao webhook do CRM do cliente (Zapier/Make/n8n, RD, HubSpot).
export type CrmParticipation = {
  id: number;
  status: string;
  created_at: Date;
  events: { id: number; name: string; slug: string };
  participants: {
    full_name: string;
    email: string | null;
    phone: string | null;
    clinic_name: string | null;
    cro_number: string | null;
    cro_state: string | null;
    city: string | null;
    state: string | null;
    chairs_count: number | null;
    marketing_consent: boolean;
  };
  draws: { drawn_at: Date; claimed_at: Date | null; prizes: { name: string } } | null;
};

export function crmPayload(p: CrmParticipation, type: 'lead' | 'prize') {
  const person = p.participants;
  const [firstName, ...rest] = person.full_name.trim().split(/\s+/);
  return {
    type,
    source: 'finora-experience',
    event: p.events,
    lead: {
      name: person.full_name,
      firstName,
      lastName: rest.join(' '),
      email: person.email,
      phone: person.phone,
      clinic: person.clinic_name,
      cro: person.cro_number,
      croState: person.cro_state,
      city: person.city,
      state: person.state,
      chairsCount: person.chairs_count,
      marketingConsent: person.marketing_consent,
      registeredAt: p.created_at.toISOString(),
    },
    participation: { id: p.id, status: p.status },
    prize: p.draws
      ? { name: p.draws.prizes.name, drawnAt: p.draws.drawn_at.toISOString(), claimedAt: p.draws.claimed_at?.toISOString() ?? null }
      : null,
  };
}
