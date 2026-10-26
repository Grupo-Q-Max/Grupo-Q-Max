import AdminSidebar from "@/components/admin/AdminSidebar";
import SystemConfigDiagnostics from "@/components/admin/SystemConfigDiagnostics";

export default function ConfiguracoesPage() {
  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text p-6 lg:p-8 max-w-6xl mx-auto w-full font-sans text-text">
        <SystemConfigDiagnostics />
      </main>
    </div>
  );
}

