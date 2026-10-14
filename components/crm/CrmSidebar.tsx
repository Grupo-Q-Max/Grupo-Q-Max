"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Handshake, Users, Settings, PieChart, Menu, X, LogOut, Lightbulb, Package, ListChecks } from "lucide-react";
import { CrmNotificationBell } from "./CrmNotificationBell";
import { useCan } from "./CrmAccess";

/** Below this width the sidebar becomes an overlay that starts closed (see crm.css). */
const MOBILE_QUERY = "(max-width: 900px)";

export function CrmSidebar() {
  // null = viewport default (open on desktop, closed on mobile), decided by CSS so
  // the server render never flashes an open sidebar on phones
  const [open, setOpen] = useState<boolean | null>(null);
  const can = useCan();
  // Settings also hosts access levels (/crm/settings/access)
  const canSettings = can("request.manage") || can("access.manage");
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
          <Handshake size={28} />
          <span>Q-Max CRM</span>
        </div>

        <nav className="crm-nav">
          <Link href="/crm" className={navClass("/crm")}>
            <LayoutDashboard size={18} />
            Pipelines
          </Link>
          <Link href="/crm/activities" className={navClass("/crm/activities")}>
            <ListChecks size={18} />
            Atividades
          </Link>
          <Link href="/crm/contacts" className={navClass("/crm/contacts")}>
            <Users size={18} />
            Contatos
          </Link>
          <Link href="/crm/products" className={navClass("/crm/products")}>
            <Package size={18} />
            Serviços
          </Link>
          {can("report.view") && (
            <Link href="/crm/reports" className={navClass("/crm/reports")}>
              <PieChart size={18} />
              Relatórios
            </Link>
          )}
          <Link href="/crm/requests" className={navClass("/crm/requests")}>
            <Lightbulb size={18} />
            Pedidos
          </Link>
          {canSettings && (
            <Link href="/crm/settings" className={navClass("/crm/settings")} style={{ marginTop: "auto" }}>
              <Settings size={18} />
              Configurações
            </Link>
          )}
          {/* Without settings, the "Sair" row is pushed to the bottom */}
          <div className="crm-nav__row" style={canSettings ? undefined : { marginTop: "auto" }}>
            <button type="button" className="crm-nav__item" onClick={logout}>
              <LogOut size={18} />
              Sair
            </button>
            <CrmNotificationBell />
          </div>
        </nav>
      </aside>
    </>
  );
}
