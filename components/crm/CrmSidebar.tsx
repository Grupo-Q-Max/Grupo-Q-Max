"use client";

import { useState } from "react";
import Link from "next/link";
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
          <Link href="/crm" className="crm-nav__item is-active">
            <LayoutDashboard size={18} />
            Pipelines
          </Link>
          <Link href="/crm/contacts" className="crm-nav__item">
            <Users size={18} />
            Contatos
          </Link>
          <a href="#" className="crm-nav__item">
            <PieChart size={18} />
            Relatórios
          </a>
          <CrmNotificationBell />
          <Link href="/crm/requests" className="crm-nav__item">
            <Lightbulb size={18} />
            Pedidos
          </Link>
          {can("access.manage") && (
            <Link href="/crm/access" className="crm-nav__item">
              <ShieldCheck size={18} />
              Acessos
            </Link>
          )}
          <a href="#" className="crm-nav__item" style={{ marginTop: "auto" }}>
            <Settings size={18} />
            Configurações
          </a>
          <button type="button" className="crm-nav__item" onClick={logout}>
            <LogOut size={18} />
            Sair
          </button>
        </nav>
      </aside>
    </>
  );
}
