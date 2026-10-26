import StandDisplayView from "@/components/admin/StandDisplayView";
import { getEvents } from "@/lib/api";
import { listableEvents } from "@/lib/event-status";

export default async function PlacaStandPage() {
  const events = await getEvents();
  const [event] = listableEvents<{ name: string; slug: string; status: string }>(Array.isArray(events) ? events : []);

  return (
    <main className="bg-paper min-h-screen">
      <StandDisplayView eventName={event?.name ?? ""} route={event?.slug ?? ""} />
    </main>
  );
}
