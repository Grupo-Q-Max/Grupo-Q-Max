"use client";

import { Suspense, startTransition, useEffect, useId, useOptimistic, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LookupInput } from "./deal/ui";
import { LayoutDashboard, Handshake, Users, Settings, PieChart, Menu, X, LogOut, Lightbulb, Package, ListChecks, CalendarCheck, FolderPlus, MoreHorizontal, Pencil, Trash2, FileText, Layers, Target, Flame, Sliders } from "lucide-react";
import { alertDialog, confirmDialog, promptDialog } from "@/components/ui/Dialogs";
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

type MenuItem = { label: string; icon: ReactNode; danger?: boolean; onSelect: () => void };

/**
 * "..." button with a native popover menu: it lives in the top layer, so the scrolling team list
 * doesn't clip it, and the browser closes it on an outside click or Esc.
 */
function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const id = useId();
  if (!items.length) return null;
  return (
    <>
      <button
        type="button"
        className="crm-space__menu-btn"
        popoverTarget={id}
        aria-label={label}
        title={label}
        onClick={(e) => {
          // Opens under the button (the popover's own toggle runs after this handler)
          const menu = document.getElementById(id);
          const rect = e.currentTarget.getBoundingClientRect();
          if (menu) {
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.left = `${rect.left}px`;
          }
        }}
      >
        <MoreHorizontal size={15} />
      </button>
      <div id={id} popover="auto" className="crm-row-menu">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`crm-row-menu__item${item.danger ? " is-danger" : ""}`}
            onClick={() => {
              document.getElementById(id)?.hidePopover();
              item.onSelect();
            }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

/**
 * Pipelines grouped by team; the open one is the `pipelineId` param, or the first one on a bare /crm.
 * With `pipeline.edit` a pipeline can be dragged onto another team; with `space.manage` teams are created here.
 * The "..." menu renames or deletes a pipeline (`pipeline.edit` / `pipeline.delete`) or a team (`space.manage`).
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
    await send("/api/crm/space", json("POST", { name }), "Novo time", "Não foi possível criar o time.");
  };

  /** Sends a change and refreshes the sidebar; shows the API error (or `fallback`) when it fails. */
  const send = async (url: string, init: RequestInit, title: string, fallback: string) => {
    const res = await fetch(url, init).catch(() => null);
    if (!res?.ok) {
      const error = res ? ((await res.json().catch(() => null))?.error as string | undefined) : undefined;
      await alertDialog(error ?? fallback, { title });
      return false;
    }
    router.refresh();
    return true;
  };
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const renamePipeline = async (p: SidebarSpace["pipelines"][number]) => {
    const name = (await promptDialog("Novo nome do pipeline", { title: "Renomear pipeline", defaultValue: p.name }))?.trim();
    if (!name || name === p.name) return;
    await send("/api/crm/pipeline/settings", json("PUT", { id: p.id, name }), "Renomear pipeline", "Não foi possível renomear o pipeline.");
  };

  const deletePipeline = async (p: SidebarSpace["pipelines"][number]) => {
    const message = `Excluir o pipeline "${p.name}"? Etapas, automações, cards arquivados e modelos dele também são excluídos.`;
    if (!(await confirmDialog(message, { danger: true, confirmLabel: "Excluir" }))) return;
    const ok = await send(`/api/crm/pipeline?id=${p.id}`, { method: "DELETE" }, "Excluir pipeline", "Não foi possível excluir o pipeline.");
    if (ok && p.id === current) router.push("/crm");
  };

  const renameSpace = async (space: SidebarSpace) => {
    const name = (await promptDialog("Novo nome do time", { title: "Renomear time", defaultValue: space.name }))?.trim();
    if (!name || name === space.name) return;
    await send("/api/crm/space", json("PATCH", { id: space.id, name }), "Renomear time", "Não foi possível renomear o time.");
  };

  const deleteSpace = async (space: SidebarSpace) => {
    const message = `Excluir o time "${space.name}"? Os pipelines dele passam para "Geral".`;
    if (!(await confirmDialog(message, { danger: true, confirmLabel: "Excluir" }))) return;
    await send(`/api/crm/space?id=${space.id}`, { method: "DELETE" }, "Excluir time", "Não foi possível excluir o time.");
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
          <summary className="crm-space__name">
            {space.name}
            {/* "Geral" (id "") is not a real team: nothing to rename or delete */}
            {space.id && can("space.manage") && (
              <RowMenu
                label={`Opções do time ${space.name}`}
                items={[
                  { label: "Renomear", icon: <Pencil size={14} />, onSelect: () => renameSpace(space) },
                  { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => deleteSpace(space) },
                ]}
              />
            )}
          </summary>
          {space.pipelines.length === 0 && <span className="crm-space__empty">Arraste pipelines para cá</span>}
          {space.pipelines.map((p) => (
            <div key={p.id} className="crm-space__row">
              <Link
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
              <RowMenu
                label={`Opções do pipeline ${p.name}`}
                items={[
                  ...(can("pipeline.edit") ? [{ label: "Renomear", icon: <Pencil size={14} />, onSelect: () => renamePipeline(p) }] : []),
                  ...(can("pipeline.delete")
                    ? [{ label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => deletePipeline(p) }]
                    : []),
                ]}
              />
            </div>
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

          <div style={{ padding: "14px 14px 4px", fontSize: "10.5px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b" }}>
            Propostas Comerciais
          </div>
          <a href="/proposta/index.html" className="crm-nav__item" title="Criar Nova Proposta Comercial">
            <FileText size={18} />
            Nova Proposta
          </a>
          <a href="/proposta/dashboard.html" className="crm-nav__item" title="Dashboard Geral de Propostas e Assinaturas">
            <Layers size={18} />
            Dashboard Propostas
          </a>
          <a href="/proposta/prospeccao.html" className="crm-nav__item" title="Radar IA de Clínicas e Dentistas">
            <Target size={18} />
            Prospecção Ativa
          </a>
          <a href="/proposta/crm.html" className="crm-nav__item" title="Funil SDR Rápido de Leads">
            <Flame size={18} />
            Funil SDR Leads
          </a>
          <a href="/proposta/crm-config.html" className="crm-nav__item" title="Configurações de Fila, Funis e Webhooks">
            <Sliders size={18} />
            Configurações CRM
          </a>
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
