import TvDisplayView from "@/components/tv/TvDisplayView";
import { getEvents } from "@/lib/api";
import { listableEvents } from "@/lib/event-status";

export default async function TvPage({ searchParams }: { searchParams?: Promise<{ event?: string }> }) {
  const params = await searchParams;
  const events = await getEvents();
  const list = listableEvents<{ id: number; slug: string; status: string }>(Array.isArray(events) ? events : []);
  const requestedId = Number(params?.event);
  const event = list.find((e) => e.id === requestedId) || list.find((e) => e.slug === "invictus") || list[0];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans overflow-hidden">
      <TvDisplayView eventId={event?.id ?? 0} route={event?.slug ?? "invictus"} />
    </div>
  );
}
