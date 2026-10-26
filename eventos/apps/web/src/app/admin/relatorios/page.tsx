import AdminSidebar from "@/components/admin/AdminSidebar";
import ExecutiveReportView from "@/components/admin/ExecutiveReportView";
import PostEventReport from "@/components/admin/PostEventReport";
import { getEvents, getEventDashboard, getEventReport } from "@/lib/api";
import { canExportParticipants } from "@/lib/admin-access";
import { getAdminRole } from "@/lib/admin-role";

type PageProps = {
  searchParams: Promise<{ event?: string }>;
};

export default async function RelatoriosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await getEvents();

  if (!Array.isArray(events) || events.length === 0) {
    return (
      <div className="adminShell">
        <AdminSidebar />
        <main className="adminMain adminPaper bg-paper text-text p-8 text-text">
          <h1 className="text-xl font-bold">Nenhum evento encontrado.</h1>
        </main>
      </div>
    );
  }

  const requestedEventId = Number(params.event);
  const selectedEvent = events.find((e: { id: number }) => e.id === requestedEventId) || events[0];
  const [dashboard, report] = await Promise.all([getEventDashboard(selectedEvent.id), getEventReport(selectedEvent.id)]);

  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full max-w-6xl mx-auto">
          <ExecutiveReportView
            data={dashboard}
            canExport={canExportParticipants(await getAdminRole())}
            funnel={report && <PostEventReport report={report} />}
          />
        </div>
      </main>
    </div>
  );
}
