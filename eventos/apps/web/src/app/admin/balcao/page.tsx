import AdminSidebar from "@/components/admin/AdminSidebar";
import QuickClaimControl from "@/components/admin/QuickClaimControl";

export default function BalcaoPage() {
  return (
    <div className="adminShell">
      <AdminSidebar />

      <main className="adminMain adminPaper bg-paper text-text p-6 lg:p-8 flex flex-col justify-center min-h-[calc(100vh-2rem)]">
        <QuickClaimControl />
      </main>
    </div>
  );
}
