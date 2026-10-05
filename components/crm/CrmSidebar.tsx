"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, Users, Settings, PieChart, Menu, X, LogOut, ShieldCheck, Lightbulb } from "lucide-react";
import { CrmNotificationBell } from "./CrmNotificationBell";
import { useCan } from "./CrmAccess";

/** Below this width the sidebar becomes an overlay that starts closed (see crm.css). */
const MOBILE_QUERY = "(max-width: 900px)";

export function CrmSidebar() {
  // null = viewport default (open on desktop, closed on mobile), decided by CSS so
  // the server render never flashes an open sidebar on phones
  const [open, setOpen] = useState<boolean | null>(null);
  const can = useCan();
  const pathname = usePathname();
  // Pipelines owns the board plus its deal and automation subpages
  const navClass = (href: string) => {
    const active = href === "/crm"
      ? pathname === "/crm" || /^\/crm\/(deal|automation)(\/|$)/.test(pathname)
      : pathname === href || pathname.startsWith(`${href}/`);
    return active ? "crm-nav__item is-active" : "crm-nav__item";
  };
  const state = open === null ? "" : open ? "is-open" : "is-closed";

  const toggle = () => {
    const isOpen = open ?? !window.matchMedia(MOBILE_QUERY).matches;
    setOpen(!isOpen);
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    location.href = "/login";
  };

  return (
    <>
      <button
        type="button"
        className={`crm-sidebar-toggle ${state}`}
        onClick={toggle}
        aria-label="Alternar menu"
      >
        <X size={20} className="crm-sidebar-toggle__close" />
        <Menu size={20} className="crm-sidebar-toggle__open" />
      </button>

      <div className={`crm-sidebar-backdrop ${state}`} onClick={() => setOpen(false)} aria-hidden />

      <aside className={`crm-sidebar ${state}`}>
        <div className="crm-sidebar__brand">
          <Target size={28} />
          <span>Q-Max CRM</span>
        </div>

        <nav className="crm-nav">
          <Link href="/crm" className={navClass("/crm")}>
            <LayoutDashboard size={18} />
            Pipelines
          </Link>
          <Link href="/crm/contacts" className={navClass("/crm/contacts")}>
            <Users size={18} />
            Contatos
          </Link>
          <a href="#" className="crm-nav__item">
            <PieChart size={18} />
            Relatórios
          </a>
          <CrmNotificationBell />
          <Link href="/crm/requests" className={navClass("/crm/requests")}>
            <Lightbulb size={18} />
            Pedidos
          </Link>
          {can("access.manage") && (
            <Link href="/crm/access" className={navClass("/crm/access")}>
              <ShieldCheck size={18} />
              Acessos
            </Link>
          )}
          {can("request.manage") && (
            <Link href="/crm/settings" className={navClass("/crm/settings")} style={{ marginTop: "auto" }}>
              <Settings size={18} />
              Configurações
            </Link>
          )}
          {/* Without settings, "Sair" is the item pushed to the bottom */}
          <button type="button" className="crm-nav__item" onClick={logout} style={can("request.manage") ? undefined : { marginTop: "auto" }}>
            <LogOut size={18} />
            Sair
          </button>
        </nav>
      </aside>
    </>
  );
}
