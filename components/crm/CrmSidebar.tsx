"use client";

import { Suspense, startTransition, useEffect, useOptimistic, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LookupInput } from "./deal/ui";
import { LayoutDashboard, Handshake, Users, Settings, PieChart, Menu, X, LogOut, Lightbulb, Package, ListChecks, CalendarCheck, FolderPlus } from "lucide-react";
import { alertDialog, promptDialog } from "@/components/ui/Dialogs";
import { CrmNotificationBell } from "./CrmNotificationBell";
import { useCan } from "./CrmAccess";

/** Below this width the sidebar becomes an overlay that starts closed (see crm.css). */
const MOBILE_QUERY = "(max-width: 900px)";

export type SidebarSpace = { id: string; name: string; pipelines: { id: string; name: string; kind: "DEALS" | "TASKS" }[] };

/** Moves a pipeline to the end of another team (`spaceId` "" = Geral). */
function movePipeline(spaces: SidebarSpace[], { pipelineId, spaceId }: { pipelineId: string; spaceId: string }) {
  const pipeline = spaces.flatMap((s) => s.pipelines).find((p) => p.id === pipelineId);
  if (!pipeline) return spaces;
  return spaces.map((s) => ({
    ...s,
    pipelines: [...s.pipelines.filter((p) => p.id !== pipelineId), ...(s.id === spaceId ? [pipeline] : [])],
  }));
}

/**
 * Pipelines grouped by team; the open one is the `pipelineId` param, or the first one on a bare /crm.
 * With `pipeline.edit` a pipeline can be dragged onto another team; with `space.manage` teams are created here.
 */
function SpaceList({ spaces, onNavigate }: { spaces: SidebarSpace[]; onNavigate: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const can = useCan();
  const canMove = can("pipeline.edit");
  const [shown, applyMove] = useOptimistic(spaces, movePipeline);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const current = pathname === "/crm" ? (params.get("pipelineId") ?? shown[0]?.pipelines[0]?.id) : null;

  const drop = (spaceId: string) => {
    const pipelineId = dragging;
    setDragging(null);
    setOver(null);
    if (!pipelineId || shown.find((s) => s.id === spaceId)?.pipelines.some((p) => p.id === pipelineId)) return;
    startTransition(async () => {
      applyMove({ pipelineId, spaceId });
      const res = await fetch("/api/crm/pipeline/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pipelineId, spaceId }),
      }).catch(() => null);
      if (!res?.ok) await alertDialog("Não foi possível mover o pipeline.", { title: "Mover pipeline" });
      router.refresh();
    });
  };

  const createSpace = async () => {
    const name = (await promptDialog("Nome do novo time", { title: "Novo time" }))?.trim();
    if (!name) return;
    const res = await fetch("/api/crm/space", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res?.ok) {
      const error = res ? ((await res.json().catch(() => null))?.error as string | undefined) : undefined;
      await alertDialog(error ?? "Não foi possível criar o time.", { title: "Novo time" });
      return;
    }
    router.refresh();
  };

  return (
    <div className="crm-spaces">
      {shown.map((space) => (
        <details
          key={space.id || "geral"}
          className={`crm-space${over === space.id ? " is-drop-target" : ""}`}
          open
          onDragOver={canMove && dragging ? (e) => { e.preventDefault(); setOver(space.id); } : undefined}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null); }}
          onDrop={canMove ? (e) => { e.preventDefault(); drop(space.id); } : undefined}
        >
          <summary className="crm-space__name">{space.name}</summary>
          {space.pipelines.length === 0 && <span className="crm-space__empty">Arraste pipelines para cá</span>}
          {space.pipelines.map((p) => (
            <Link
              key={p.id}
              href={`/crm?pipelineId=${p.id}`}
              onClick={onNavigate}
              draggable={canMove}
              onDragStart={canMove ? (e) => { e.dataTransfer.effectAllowed = "move"; setDragging(p.id); } : undefined}
              onDragEnd={() => { setDragging(null); setOver(null); }}
              className={`crm-space__item${p.id === current ? " is-active" : ""}${p.id === dragging ? " is-dragging" : ""}`}
            >
              {p.kind === "TASKS" ? <ListChecks size={15} /> : <Handshake size={15} />}
              <span>{p.name}</span>
            </Link>
          ))}
        </details>
      ))}
      {can("space.manage") && (
        <button type="button" className="crm-space__add" onClick={createSpace}>
          <FolderPlus size={14} /> Novo time
        </button>
      )}
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
