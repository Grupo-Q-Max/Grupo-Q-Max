import AdminSidebar from "@/components/admin/AdminSidebar";
import AuditHistoryClient from "@/components/audit/AuditHistoryClient";

export default function HistoricoPage() {
  return (
    <div className="adminShell">
      <AdminSidebar />
      <main className="adminMain adminPaper bg-paper text-text">
        <AuditHistoryClient />
      </main>
    </div>
  );
}
