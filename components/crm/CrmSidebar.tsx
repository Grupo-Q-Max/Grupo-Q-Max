"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LookupInput } from "./deal/ui";
import { LayoutDashboard, Handshake, Users, Settings, PieChart, Menu, X, LogOut, Lightbulb, Package, ListChecks, CalendarCheck } from "lucide-react";
import { CrmNotificationBell } from "./CrmNotificationBell";
import { useCan } from "./CrmAccess";

/** Below this width the sidebar becomes an overlay that starts closed (see crm.css). */
const MOBILE_QUERY = "(max-width: 900px)";

export type SidebarSpace = { id: string; name: string; pipelines: { id: string; name: string; kind: "DEALS" | "TASKS" }[] };

/** Pipelines grouped by space; the open one is the `pipelineId` param, or the first one on a bare /crm. */
function SpaceList({ spaces, onNavigate }: { spaces: SidebarSpace[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = pathname === "/crm" ? (params.get("pipelineId") ?? spaces[0]?.pipelines[0]?.id) : null;

  return (
    <div className="crm-spaces">
      {spaces.map((space) => (
        <details key={space.id || "geral"} className="crm-space" open>
          <summary className="crm-space__name">{space.name}</summary>
          {space.pipelines.map((p) => (
            <Link
              key={p.id}
              href={`/crm?pipelineId=${p.id}`}
              onClick={onNavigate}
              className={`crm-space__item${p.id === current ? " is-active" : ""}`}
            >
              {p.kind === "TASKS" ? <ListChecks size={15} /> : <Handshake size={15} />}
              <span>{p.name}</span>
            </Link>
          ))}
        </details>
      ))}
    </div>
  );
}

export function CrmSidebar({ spaces }: { spaces: SidebarSpace[] }) {
  // null = viewport default (open on desktop, closed on mobile), decided by CSS so
  // the server render never flashes an open sidebar on phones
  const [open, setOpen] = useState<boolean | null>(null);
  const can = useCan();
  // Settings also hosts access levels (/crm/settings/access)
  const canSettings = can("request.manage") || can("access.manage") || can("space.manage");
  const pathname = usePathname();
  // Pipelines owns the board plus its deal and automation subpages
  const navClass = (href: string) => {
    const active = href === "/crm"
      ? pathname === "/crm" || /^\/crm\/(deal|automation)(\/|$)/.test(pathname)
      : pathname === href || pathname.startsWith(`${href}/`);
    return active ? "crm-nav__item is-active" : "crm-nav__item";
  };
  const state = open === null ? "" : open ? "is-open" : "is-closed";
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Ctrl/Cmd+K focuses the search (opening the sidebar on phones)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setOpen(true);
      document.querySelector<HTMLInputElement>(".crm-search input")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

        <div className="crm-search">
          <LookupInput<{ id: string; name: string; number: number; detail: string }>
            type="card"
            params="&global=1"
            value={search}
            placeholder="Buscar (Ctrl+K)"
            onChange={setSearch}
            describe={(card) => card.detail}
            onPick={(card) => {
              setSearch("");
              if (window.matchMedia(MOBILE_QUERY).matches) setOpen(false);
              router.push(`/crm/deal/details/${card.number}`);
            }}
          />
        </div>

        <nav className="crm-nav">
          <Link href="/crm/me" className={navClass("/crm/me")}>
            <CalendarCheck size={18} />
            Minhas tarefas
          </Link>
          <Link href="/crm" className={navClass("/crm")}>
            <LayoutDashboard size={18} />
            Pipelines
          </Link>
          <Suspense>
            <SpaceList spaces={spaces} onNavigate={() => window.matchMedia(MOBILE_QUERY).matches && setOpen(false)} />
          </Suspense>
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
