import AdminSidebarNav from "@/components/admin/AdminSidebarNav";
import { getAdminRole } from "@/lib/admin-role";
import { getEvents } from "@/lib/api";

// Lê o perfil da sessão no servidor para o menu mostrar só o que o perfil acessa.
export default async function AdminSidebar() {
  const events: { id: number; name: string; slug: string; status: string; experience?: "ROLETA" | "COFRE" }[] = await getEvents().catch(() => []);
  const active = events.filter((e) => e.status === "ACTIVE");
  const roletas = (active.length > 0 ? active : events).map((e) => {
    const isCofre = e.experience === "COFRE";
    return {
      label: `${isCofre ? "Cofre" : "Roleta"} · ${e.name}`,
      href: `/${e.slug}/${isCofre ? "cofre" : "roleta"}`,
    };
  });

  return <AdminSidebarNav role={await getAdminRole()} roletas={roletas} />;
}
