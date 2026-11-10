import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminUsersManagement from "@/components/admin/AdminUsersManagement";

// Só endereço interno: a chamada leva x-finora-admin-key.
const API_URL =
  process.env.FINORA_INTERNAL_API_URL || "http://127.0.0.1:3334/api/v1";

const ADMIN_KEY = process.env.FINORA_ADMIN_API_KEY ?? "";

async function getAdminUsers() {
  try {
    const res = await fetch(`${API_URL}/admin-users`, {
      cache: "no-store",
      headers: {
        "x-finora-admin-key": ADMIN_KEY,
      },
    });

    if (!res.ok) {
      return [];
    }

    return res.json();
  } catch {
    return [];
  }
}

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="adminShell">
      <AdminSidebar />
      <main className="adminMain adminPaper bg-paper text-text">
        <AdminUsersManagement initialUsers={users} />
      </main>
    </div>
  );
}
