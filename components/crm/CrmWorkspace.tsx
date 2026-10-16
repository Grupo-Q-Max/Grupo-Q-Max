"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmKanban } from "./CrmKanban";
import type { CrmDeal } from "./DealCard";
import { DealDetailsPanel } from "./deal/DealDetailsPanel";
import { PRIORITIES, formatMinutes, priorityLabel } from "./deal/types";
import { FilterField, FilterSearch, type FilterChip } from "./FilterSearch";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { matches } from "@/lib/text-search";
import { dueState, todayKey } from "@/lib/crm-due";
import { Kanban, List, Calendar, CalendarDays, ChartGantt, TrendingUp, ArrowDown, Archive, Download } from "lucide-react";
import { CrmCalendar } from "./CrmCalendar";
import { CrmTimeline } from "./CrmTimeline";
import { CrmSavedViews } from "./CrmSavedViews";
import { CrmBulkBar } from "./CrmBulkBar";
import { alertDialog } from "@/components/ui/Dialogs";
import { downloadCsv } from "@/lib/csv";

type DealFilters = {
  q: string;
  responsibleId: string;
  status: string;
  activity: string;
  from: string;
  to: string;
  priority: string;
  tagId: string;
  due: string;
};
const NO_FILTERS: DealFilters = { q: "", responsibleId: "", status: "", activity: "", from: "", to: "", priority: "", tagId: "", due: "" };
const NO_RESPONSIBLE = "none";
const NO_PRIORITY = "none";
const DEAL_STATUSES: Record<string, string> = { OPEN: "Aberto", WON: "Ganho", LOST: "Perdido" };
const TASK_STATUSES: Record<string, string> = { OPEN: "Aberta", WON: "Concluída" };
const ACTIVITIES: Record<string, string> = { overdue: "Atividade atrasada", none: "Sem atividade pendente" };
const DUE: Record<string, string> = { overdue: "Atrasada", today: "Vence hoje", week: "Próximos 7 dias", none: "Sem prazo" };
const VIEWS = ["kanban", "list", "calendar", "timeline", "activities"] as const;
type View = (typeof VIEWS)[number];
type Sort = "due" | "priority" | null;

/** Board URL with the filters, view and sort, so a filtered board can be shared and survives a reload. */
function boardUrl(pipelineId: string, filters: DealFilters, view: View, sort: Sort) {
  const query = boardQuery(filters, view, sort);
  return `/crm?pipelineId=${encodeURIComponent(pipelineId)}${query && `&${query}`}`;
}

/** The filters, view and sort as a query string ("" = the default board); also what a saved view stores. */
function boardQuery(filters: DealFilters, view: View, sort: Sort) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (view !== "kanban") params.set("view", view);
  if (sort) params.set("sort", sort);
  return params.toString();
}

/** Reverse of boardUrl / boardQuery, from the current address by default. */
function readBoardUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const filters = Object.fromEntries(Object.keys(NO_FILTERS).map((key) => [key, params.get(key) ?? ""])) as DealFilters;
  const view = VIEWS.find((v) => v === params.get("view")) ?? "kanban";
  const sort = params.get("sort");
  return { filters, view, sort: (sort === "due" || sort === "priority" ? sort : null) as Sort };
}

/** Shortcuts outside text fields: "/" focuses the search, "n" opens "Nova tarefa / Novo negócio". */
function useBoardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".crm-toolbar input[type=search]")?.focus();
      } else if (e.key === "n" || e.key === "N") {
        document.querySelector<HTMLButtonElement>("[data-shortcut=new-card]")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Local YYYY-MM-DD, comparable with <input type="date"> values. */
const dayOf = (date: string | Date) => new Date(date).toLocaleDateString("sv-SE");
/** YYYY-MM-DD → DD/MM/YYYY */
const showDay = (day: string) => day.split("-").reverse().join("/");
const inAWeek = () => todayKey(new Date(Date.now() + 7 * 86_400_000));
/** Priority weight for sorting: urgent first, no priority last */
const priorityRank = (deal: CrmDeal) => (deal.priority ? PRIORITIES.findIndex((p) => p.value === deal.priority) : -1);

function matchesDue(deal: CrmDeal, due: string) {
  const date = deal.closeDate ? new Date(deal.closeDate) : null;
  // A done task is never late
  const state = deal.status === "WON" && date ? "upcoming" : dueState(date, true);
  if (due === "week") return !!date && state !== "overdue" && state !== "none" && date.toISOString().slice(0, 10) <= inAWeek();
  return state === due;
}

function matchesDeal(deal: CrmDeal, f: DealFilters) {
  const next = deal.activities?.[0];
  if (!matches(f.q, deal.title, deal.company, deal.contactName, `#${deal.number}`)) return false;
  if (f.responsibleId && (deal.responsible?.id ?? NO_RESPONSIBLE) !== f.responsibleId) return false;
  if (f.status && (deal.status ?? "OPEN") !== f.status) return false;
  // Same overdue rule as DealCard
  if (f.activity === "overdue" && !(next?.deadline && new Date(next.deadline).getTime() < Date.now())) return false;
  if (f.activity === "none" && (deal._count?.activities ?? 0) > 0) return false;
  if ((f.from || f.to) && !deal.createdAt) return false;
  if (f.from && dayOf(deal.createdAt!) < f.from) return false;
  if (f.to && dayOf(deal.createdAt!) > f.to) return false;
  if (f.priority && (deal.priority ?? NO_PRIORITY) !== f.priority) return false;
  if (f.tagId && !deal.tags?.some((t) => t.id === f.tagId)) return false;
  if (f.due && !matchesDue(deal, f.due)) return false;
  return true;
}

/** Opens the deal panel over any view; the open deal lives in the URL path, like Bitrix24: /crm/deal/details/<number> */
function useDealPanel(pipelineId: string, initialDealId?: string, closeUrl?: React.RefObject<string>) {
  /** Cards in the order the current view shows them, for "j" / "k" in the panel */
  const orderRef = useRef<CrmDeal[]>([]);
  const router = useRouter();
  const [openDealId, setOpenDealId] = useState<string | null>(initialDealId ?? null);
  const dealChangedRef = useRef(false);
  const syncBoardRef = useRef<(() => void) | null>(null);
  /** Extra refresh run on every change made in the panel */
  const changedRef = useRef<(() => void) | null>(null);

  // Legacy links (/crm?deal=<id>) still open the panel; the URL is fixed once the deal loads
  useEffect(() => {
    const legacyId = new URLSearchParams(window.location.search).get("deal");
    if (legacyId) setOpenDealId(legacyId);
  }, []);

  const showDealUrl = useCallback((number: number) => {
    window.history.replaceState(null, "", `/crm/deal/details/${number}`);
  }, []);

  const openDeal = useCallback(
    (deal: CrmDeal) => {
      dealChangedRef.current = false;
      setOpenDealId(deal.id);
      showDealUrl(deal.number);
    },
    [showDealUrl]
  );

  const closeDeal = useCallback(() => {
    setOpenDealId(null);
    window.history.replaceState(null, "", closeUrl?.current || `/crm?pipelineId=${pipelineId}`);
    // Server data (list view, header) is refreshed only once the panel closes, so the
    // board isn't re-rendered for the deal URL while it's open
    if (dealChangedRef.current) router.refresh();
  }, [pipelineId, router]);

  const panel = openDealId && (
    <DealDetailsPanel
      key={openDealId}
      dealId={openDealId}
      onLoad={(deal) => showDealUrl(deal.number)}
      onClose={closeDeal}
      onOpenCard={(card) => {
        dealChangedRef.current = true;
        setOpenDealId(card.id);
        showDealUrl(card.number);
      }}
      onNavigate={(step) => {
        const list = orderRef.current;
        const next = list[list.findIndex((c) => c.id === openDealId) + step];
        if (!next) return;
        setOpenDealId(next.id);
        showDealUrl(next.number);
      }}
      onChanged={() => {
        dealChangedRef.current = true;
        syncBoardRef.current?.();
        changedRef.current?.();
      }}
    />
  );
  return { openDeal, panel, syncBoardRef, changedRef, orderRef };
}

export function CrmWorkspace({ pipeline, initialDealId }: { pipeline: any; initialDealId?: string }) {
  const isTasks = pipeline.kind === "TASKS";
  const [view, setView] = useState<View>("kanban");
  const router = useRouter();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [sort, setSort] = useState<Sort>(null);
  useBoardShortcuts();

  // Filters, view and sort live in the URL (read once on mount, written back while the panel is closed)
  // State, not a ref: the write below must wait for the render that has the URL's values, or it would
  // overwrite the URL with the empty defaults first (and Strict Mode's second read would see that)
  const [urlRead, setUrlRead] = useState(false);
  const closeUrl = useRef("");
  const applyQuery = useCallback((search?: string) => {
    const fromUrl = readBoardUrl(search);
    setFilters(fromUrl.filters);
    setView(fromUrl.view);
    setSort(fromUrl.sort);
  }, []);
  useEffect(() => {
    applyQuery();
    setUrlRead(true);
  }, [applyQuery]);
  useEffect(() => {
    if (!urlRead) return;
    closeUrl.current = boardUrl(pipeline.id, filters, view, sort);
    if (window.location.pathname === "/crm") window.history.replaceState(null, "", closeUrl.current);
  }, [urlRead, pipeline.id, filters, view, sort]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // List view "Arquivados": archived cards, loaded on demand (null = showing the board's cards)
  const [archived, setArchived] = useState<CrmDeal[] | null>(null);
  const loadArchived = useCallback(async () => {
    const res = await fetch(`/api/crm/card?archivedOf=${pipeline.id}`, { cache: "no-store" });
    setArchived(res.ok ? await res.json() : []);
  }, [pipeline.id]);
  const { openDeal, panel, syncBoardRef, changedRef, orderRef } = useDealPanel(pipeline.id, initialDealId, closeUrl);
  // Archiving or restoring from the panel changes the archived list too
  changedRef.current = archived ? loadArchived : null;
  const set = (changes: Partial<DealFilters>) => setFilters((f) => ({ ...f, ...changes }));
  const filtering = Object.values(filters).some(Boolean);
  const isDealVisible = useCallback((deal: CrmDeal) => matchesDeal(deal, filters), [filters]);
  const statuses = isTasks ? TASK_STATUSES : DEAL_STATUSES;

  // Collect all cards across all stages for list and activity views
  const everyCard: (CrmDeal & { stageName: string; updatedAt: string | Date })[] = pipeline.stages.flatMap((stage: any) =>
    stage.cards.map((card: any) => ({ ...card, stageName: stage.name }))
  );
  const stageName = (id: string) => pipeline.stages.find((s: any) => s.id === id)?.name ?? "";
  const listed = view === "list" && archived ? archived.map((card) => ({ ...card, stageName: stageName(card.stageId) } as (typeof everyCard)[number])) : everyCard;
  const allCards = listed.filter(isDealVisible);
  if (sort === "due") allCards.sort((a, b) => (a.closeDate ? new Date(a.closeDate).getTime() : Infinity) - (b.closeDate ? new Date(b.closeDate).getTime() : Infinity));
  if (sort === "priority") allCards.sort((a, b) => priorityRank(b) - priorityRank(a));
  orderRef.current = allCards;
  const emptyMessage = filtering ? `Nenhum ${isTasks ? "item" : "negócio"} corresponde aos filtros.` : null;

  const responsibles = [
    ...new Map(everyCard.flatMap((c) => (c.responsible ? [[c.responsible.id, c.responsible.name] as const] : []))),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const responsibleName = (id: string) =>
    id === NO_RESPONSIBLE ? "Sem responsável" : responsibles.find(([rid]) => rid === id)?.[1] ?? "Responsável";
  const tags = [...new Map(everyCard.flatMap((c) => (c.tags ?? []).map((t) => [t.id, t] as const))).values()].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const chips: FilterChip[] = [
    filters.responsibleId && { key: "responsible", label: responsibleName(filters.responsibleId), onRemove: () => set({ responsibleId: "" }) },
    filters.status && { key: "status", label: statuses[filters.status], onRemove: () => set({ status: "" }) },
    filters.activity && { key: "activity", label: ACTIVITIES[filters.activity], onRemove: () => set({ activity: "" }) },
    filters.priority && {
      key: "priority",
      label: filters.priority === NO_PRIORITY ? "Sem prioridade" : `Prioridade ${priorityLabel(filters.priority)?.toLowerCase()}`,
      onRemove: () => set({ priority: "" }),
    },
    filters.tagId && { key: "tag", label: tags.find((t) => t.id === filters.tagId)?.name ?? "Etiqueta", onRemove: () => set({ tagId: "" }) },
    filters.due && { key: "due", label: DUE[filters.due], onRemove: () => set({ due: "" }) },
    filters.from && { key: "from", label: `Criado de ${showDay(filters.from)}`, onRemove: () => set({ from: "" }) },
    filters.to && { key: "to", label: `Criado até ${showDay(filters.to)}`, onRemove: () => set({ to: "" }) },
  ].filter((c): c is FilterChip => Boolean(c));

  // Only rows still visible count as selected (filters may hide some after picking them)
  const selectedIds = allCards.filter((c) => selected.has(c.id)).map((c) => c.id);
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allSelected = allCards.length > 0 && selectedIds.length === allCards.length;
  const selectAllHeader = (
    <th className="crm-table__check">
      <input
        type="checkbox"
        aria-label="Selecionar todos"
        checked={allSelected}
        onChange={() => setSelected(allSelected ? new Set() : new Set(allCards.map((c) => c.id)))}
      />
    </th>
  );
  const checkCell = (id: string) => (
    <td className="crm-table__check" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" aria-label="Selecionar" checked={selected.has(id)} onChange={() => toggle(id)} />
    </td>
  );

  const day = (date: string | Date | null | undefined) => (date ? new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "");
  // Exports the rows on screen (filters, sort and "Arquivados" applied)
  const exportCsv = () =>
    isTasks
      ? downloadCsv(`tarefas-${todayKey(new Date())}.csv`, [
          ["Nº", "Tarefa", "Coluna", "Status", "Prioridade", "Etiquetas", "Prazo", "Responsável", "Estimativa", "Tempo gasto", "Criada em"],
          ...allCards.map((c) => [
            c.number,
            c.title,
            c.stageName,
            TASK_STATUSES[c.status ?? "OPEN"] ?? c.status,
            priorityLabel(c.priority ?? null),
            c.tags?.map((t) => t.name).join(", "),
            [day(c.closeDate), c.closeDate && c.dueTime].filter(Boolean).join(" "),
            c.responsible?.name,
            formatMinutes(c.estimateMinutes ?? null),
            formatMinutes(c.spentMinutes ?? null),
            c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "",
          ]),
        ])
      : downloadCsv(`negocios-${todayKey(new Date())}.csv`, [
          ["Nº", "Negócio", "Empresa", "Fase", "Status", "Valor", "Responsável", "Criado em"],
          ...allCards.map((c) => [
            c.number,
            c.title,
            c.company,
            c.stageName,
            DEAL_STATUSES[c.status ?? "OPEN"] ?? c.status,
            Number(c.value).toFixed(2).replace(".", ","),
            c.responsible?.name,
            c.createdAt ? new Date(c.createdAt).toLocaleDateString("pt-BR") : "",
          ]),
        ]);

  const sortHeader = (key: "due" | "priority", label: string) => (
    <th>
      <button type="button" className={`crm-table__sort ${sort === key ? "is-active" : ""}`} onClick={() => setSort((s) => (s === key ? null : key))}>
        {label} {sort === key && <ArrowDown size={12} />}
      </button>
    </th>
  );

  return (
    <>
      <div className="crm-toolbar">
        <FilterSearch
          value={filters.q}
          onChange={(q) => set({ q })}
          placeholder={isTasks ? "Buscar por tarefa ou #nº" : "Buscar por negócio, empresa, contato ou #nº"}
          chips={chips}
          onClear={() => setFilters(NO_FILTERS)}
        >
          <FilterField label="Responsável">
            <Select className="crm-access__select" value={filters.responsibleId} onChange={(e) => set({ responsibleId: e.target.value })} aria-label="Responsável">
              <option value="">Todos</option>
              <option value={NO_RESPONSIBLE}>Sem responsável</option>
              {responsibles.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Status">
            <Select className="crm-access__select" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
              <option value="">Todos</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
          {isTasks ? (
            <>
              <FilterField label="Prazo">
                <Select className="crm-access__select" value={filters.due} onChange={(e) => set({ due: e.target.value })} aria-label="Prazo">
                  <option value="">Todos</option>
                  {Object.entries(DUE).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Prioridade">
                <Select className="crm-access__select" value={filters.priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Prioridade">
                  <option value="">Todas</option>
                  {[...PRIORITIES].reverse().map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                  <option value={NO_PRIORITY}>Sem prioridade</option>
                </Select>
              </FilterField>
              {tags.length > 0 && (
                <FilterField label="Etiqueta">
                  <Select className="crm-access__select" value={filters.tagId} onChange={(e) => set({ tagId: e.target.value })} aria-label="Etiqueta">
                    <option value="">Todas</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </FilterField>
              )}
            </>
          ) : (
            <FilterField label="Atividade">
              <Select className="crm-access__select" value={filters.activity} onChange={(e) => set({ activity: e.target.value })} aria-label="Atividade">
                <option value="">Todas</option>
                {Object.entries(ACTIVITIES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FilterField>
          )}
          <FilterField label="Data de criação">
            <div className="crm-filter-panel__range">
              <DatePicker className="crm-access__select" aria-label="Criado de" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              <span>até</span>
              <DatePicker className="crm-access__select" aria-label="Criado até" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </FilterField>
        </FilterSearch>
        <CrmSavedViews pipelineId={pipeline.id} query={boardQuery(filters, view, sort)} onApply={applyQuery} />
        <div className="crm-toolbar__views">
          <button
            className={`view-btn ${view === "kanban" ? "is-active" : ""}`}
            onClick={() => setView("kanban")}
          >
            <Kanban size={16} /> Kanban
          </button>
          <button
            className={`view-btn ${view === "list" ? "is-active" : ""}`}
            onClick={() => setView("list")}
          >
            <List size={16} /> Lista
          </button>
          {isTasks && (
            <button className={`view-btn ${view === "calendar" ? "is-active" : ""}`} onClick={() => setView("calendar")}>
              <CalendarDays size={16} /> Calendário
            </button>
          )}
          {isTasks && (
            <button className={`view-btn ${view === "timeline" ? "is-active" : ""}`} onClick={() => setView("timeline")}>
              <ChartGantt size={16} /> Linha do tempo
            </button>
          )}
          <button
            className={`view-btn ${view === "activities" ? "is-active" : ""}`}
            onClick={() => setView("activities")}
          >
            <Calendar size={16} /> Atividades
          </button>
        </div>
      </div>

      <div className="crm-content">
        {view === "kanban" && (
          <CrmKanban pipeline={pipeline} onOpenDeal={openDeal} syncBoardRef={syncBoardRef} isDealVisible={filtering ? isDealVisible : undefined} />
        )}

        {view === "list" && (
          <div className="crm-list-view">
            <div className="crm-list-view__bar">
              <button type="button" className="view-btn" onClick={exportCsv} disabled={allCards.length === 0} title="Exportar as linhas da lista">
                <Download size={16} /> Exportar CSV
              </button>
              <button
                type="button"
                className={`view-btn ${archived ? "is-active" : ""}`}
                onClick={() => {
                  setSelected(new Set());
                  if (archived) setArchived(null);
                  else loadArchived();
                }}
              >
                <Archive size={16} /> Arquivados
              </button>
            </div>
            <CrmBulkBar
              ids={selectedIds}
              stages={pipeline.stages}
              isTasks={isTasks}
              archived={!!archived}
              onDone={() => {
                setSelected(new Set());
                if (archived) loadArchived();
              }}
            />
            <table className="crm-table">
              <thead>
                {isTasks ? (
                  <tr>
                    {selectAllHeader}
                    <th>Tarefa</th>
                    <th>Coluna</th>
                    {sortHeader("priority", "Prioridade")}
                    <th>Etiquetas</th>
                    {sortHeader("due", "Prazo")}
                    <th>Responsável</th>
                  </tr>
                ) : (
                  <tr>
                    {selectAllHeader}
                    <th>Negócio</th>
                    <th>Empresa</th>
                    <th>Fase</th>
                    <th>Valor</th>
                    <th>Data de Criação</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {allCards.map((card) =>
                  isTasks ? (
                    <tr key={card.id} className="crm-table__row--link" onClick={() => openDeal(card)}>
                      {checkCell(card.id)}
                      <td className={card.status === "WON" ? "crm-table__done" : undefined} style={{ fontWeight: 600, color: "#fff" }}>
                        {card.title}
                      </td>
                      <td>
                        <span className="crm-badge">{card.stageName}</span>
                      </td>
                      <td>{card.priority ? <span className={`crm-priority crm-priority--${card.priority.toLowerCase()}`}>{priorityLabel(card.priority)}</span> : "—"}</td>
                      <td>
                        <span className="kanban-card__tags">
                          {card.tags?.map((tag) => (
                            <span key={tag.id} className="crm-tag" style={{ "--tag-color": tag.color } as React.CSSProperties}>
                              {tag.name}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td className={card.status !== "WON" && matchesDue(card, "overdue") ? "crm-table__overdue" : undefined}>
                        {card.closeDate ? `${new Date(card.closeDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}${card.dueTime ? ` ${card.dueTime}` : ""}` : "—"}
                      </td>
                      <td>{card.responsible?.name ?? "—"}</td>
                    </tr>
                  ) : (
                    <tr key={card.id} className="crm-table__row--link" onClick={() => openDeal(card)}>
                      {checkCell(card.id)}
                      <td style={{ fontWeight: 600, color: "#fff" }}>{card.title}</td>
                      <td>{card.company || "—"}</td>
                      <td>
                        <span className="crm-badge">{card.stageName}</span>
                      </td>
                      <td style={{ color: "#4ceb95", fontWeight: 600 }}>
                        R$ {Number(card.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td>{new Date(card.createdAt!).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  )
                )}
                {allCards.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#a5a0aa" }}>
                      {emptyMessage ?? (archived ? "Nenhum item arquivado." : `Nenhum ${isTasks ? "item" : "negócio"} encontrado neste pipeline.`)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === "calendar" && (
          <CrmCalendar
            undated={allCards.filter((c) => !c.closeDate).length}
            items={allCards.flatMap((card) =>
              card.closeDate
                ? [
                    {
                      key: card.id,
                      day: new Date(card.closeDate).toISOString().slice(0, 10),
                      title: card.title,
                      tone: card.status === "WON" ? ("done" as const) : matchesDue(card, "overdue") ? ("overdue" as const) : undefined,
                      onOpen: () => openDeal(card),
                    },
                  ]
                : []
            )}
            onMove={async (id, closeDate) => {
              const res = await fetch("/api/crm/card", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, closeDate }),
              });
              if (!res.ok) return alertDialog((await res.json().catch(() => null))?.error ?? "Não foi possível alterar o prazo.");
              router.refresh();
            }}
          />
        )}

        {view === "timeline" && (
          <CrmTimeline
            undated={allCards.filter((c) => !c.closeDate).length}
            items={allCards.flatMap((card) => {
              if (!card.closeDate) return [];
              const end = new Date(card.closeDate).toISOString().slice(0, 10);
              return [
                {
                  key: card.id,
                  title: card.title,
                  start: card.startDate ? new Date(card.startDate).toISOString().slice(0, 10) : end,
                  end,
                  priority: card.priority,
                  tone: card.status === "WON" ? ("done" as const) : matchesDue(card, "overdue") ? ("overdue" as const) : undefined,
                  onOpen: () => openDeal(card),
                },
              ];
            })}
          />
        )}

        {view === "activities" && (
          <div className="crm-activities-view">
            <div className="crm-activities-header">
              <h3>Histórico de Movimentações</h3>
              <p>Acompanhe as atualizações recentes {isTasks ? "das suas tarefas" : "e o pulso das suas vendas"}.</p>
            </div>

            <div className="crm-timeline">
              {[...allCards]
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((card, idx) => (
                  <div className="crm-timeline-item" key={`${card.id}-${idx}`}>
                    <div className="crm-timeline-icon">
                      <TrendingUp size={16} />
                    </div>
                    <div className="crm-timeline-content">
                      <div className="crm-timeline-title">
                        {/* updatedAt is any change, not only a column move */}
                        {isTasks ? "Tarefa" : "Negócio"} <strong>{card.title}</strong> atualizad{isTasks ? "a" : "o"} · {isTasks ? "coluna" : "fase"}{" "}
                        <span className="crm-badge">{card.stageName}</span>
                      </div>
                      <div className="crm-timeline-time">{new Date(card.updatedAt).toLocaleString("pt-BR")}</div>
                    </div>
                  </div>
                ))}
              {allCards.length === 0 && (
                <div style={{ color: "#a5a0aa", marginTop: "20px" }}>{emptyMessage ?? "Sem histórico de atividades."}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {panel}
    </>
  );
}
