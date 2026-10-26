import TvDisplayView from "@/components/tv/TvDisplayView";
import { getEvents } from "@/lib/api";
import { listableEvents } from "@/lib/event-status";

export default async function TvPage() {
  const events = await getEvents();
  const [event] = listableEvents<{ id: number; slug: string; status: string }>(Array.isArray(events) ? events : []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans overflow-hidden">
      <TvDisplayView eventId={event?.id ?? 0} route={event?.slug ?? ""} />
    </div>
  );
}
