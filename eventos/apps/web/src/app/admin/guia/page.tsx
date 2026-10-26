import AdminSidebar from "@/components/admin/AdminSidebar";
import FieldGuideView from "@/components/admin/FieldGuideView";
import { getEvents } from "@/lib/api";
import { listableEvents } from "@/lib/event-status";

export default async function GuiaPage() {
  const [event] = listableEvents<{ slug: string; status: string }>(await getEvents().catch(() => []));

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text p-6 lg:p-8 flex flex-col justify-center min-h-[calc(100vh-2rem)]">
        <FieldGuideView route={event?.slug ?? ""} />
      </main>
    </div>
  );
}
