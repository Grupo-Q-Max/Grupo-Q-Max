import { cache } from "react";
import { notFound } from "next/navigation";
import { getEvents } from "@/lib/api";

export type EventRecord = {
  id: number;
  name: string;
  slug: string;
  status: string;
  experience: "ROLETA" | "COFRE";
  accent_color: string | null;
  accent_ink_color: string | null;
};

// Endereços antigos (QRs impressos, links já enviados) de antes da rota única.
const LEGACY_ROUTES: Record<string, string> = {
  clinicorp: "clinicorp",
  invictus: "invictus",
};

// Evento da rota pública /[evento]: slug exato do banco ou endereço antigo.
// Endereço antigo pega o evento mais recente cujo slug/nome contém a palavra, ativo primeiro.
export const getEventByRoute = cache(async (route: string): Promise<EventRecord> => {
  const events: EventRecord[] = await getEvents().catch(() => []);
  const exact = events.find((e) => e.slug === route);
  if (exact) return exact;

  const keyword = LEGACY_ROUTES[route];
  if (keyword) {
    const matches = events.filter((e) => `${e.slug} ${e.name}`.toLowerCase().includes(keyword));
    const legacy = matches.find((e) => e.status === "ACTIVE") ?? matches[0];
    if (legacy) return legacy;
  }

  notFound();
});
