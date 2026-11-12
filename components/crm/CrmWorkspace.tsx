"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CrmKanban, sortCards } from "./CrmKanban";
import type { CrmDeal } from "./DealCard";
import { DealDetailsPanel } from "./deal/DealDetailsPanel";
import { PRIORITIES, formatMinutes, priorityLabel, type Priority } from "./deal/types";
import { FilterField, FilterSearch, type FilterChip } from "./FilterSearch";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { matches } from "@/lib/text-search";
import { dueState, todayKey } from "@/lib/crm-due";
import { Kanban, List, Calendar, CalendarDays, ChartGantt, TrendingUp, ArrowDown, Archive, Download, CheckSquare, Users } from "lucide-react";
import { CrmCalendar } from "./CrmCalendar";
import { CrmTimeline } from "./CrmTimeline";
import { CrmWorkload } from "./CrmWorkload";
import { CrmSavedViews } from "./CrmSavedViews";
import { CrmBulkBar } from "./CrmBulkBar";
import { alertDialog } from "@/components/ui/Dialogs";
import { downloadCsv } from "@/lib/csv";
import { CrmFunnelSummary } from "./CrmFunnelSummary";

type DealFilters = {
  q: string;
  /** Multi-value filters (responsibleId, stageId, status, priority, tagId) hold comma-separated values */
  responsibleId: string;
  stageId: string;
  status: string;
  activity: string;
  from: string;
  to: string;
  priority: string;
  tagId: string;
  due: string;
  dueFrom: string;
  dueTo: string;
  startFrom: string;
  startTo: string;
  overEstimate: string;
};
const NO_FILTERS: DealFilters = { q: "", responsibleId: "", stageId: "", status: "", activity: "", from: "", to: "", priority: "", tagId: "", due: "", dueFrom: "", dueTo: "", startFrom: "", startTo: "", overEstimate: "" };
const NO_RESPONSIBLE = "none";
const NO_PRIORITY = "none";
const DEAL_STATUSES: Record<string, string> = { OPEN: "Aberto", WON: "Ganho", LOST: "Perdido" };
const TASK_STATUSES: Record<string, string> = { OPEN: "Aberta", WON: "Concluída" };
const ACTIVITIES: Record<string, string> = { overdue: "Atividade atrasada", none: "Sem atividade pendente" };
const DUE: Record<string, string> = { overdue: "Atrasada", today: "Vence hoje", week: "Próximos 7 dias", none: "Sem prazo" };
const VIEWS = ["kanban", "list", "calendar", "timeline", "workload", "activities"] as const;
type View = (typeof VIEWS)[number];
type ListFilter = "responsibleId" | "stageId" | "status" | "priority" | "tagId";
type Sort = "due" | "priority" | null;
/** Kanban swimlanes: one row of columns per responsible, priority or tag */
const LANES = { responsible: "Responsável", priority: "Prioridade", tag: "Etiqueta" } as const;
type Lanes = keyof typeof LANES | null;

/** Board URL with the filters, view, sort and lanes, so a filtered board can be shared and survives a reload. */
function boardUrl(pipelineId: string, filters: DealFilters, view: View, sort: Sort, lanes: Lanes) {
  const query = boardQuery(filters, view, sort, lanes);
  return `/crm?pipelineId=${encodeURIComponent(pipelineId)}${query && `&${query}`}`;
}

/** The filters, view, sort and lanes as a query string ("" = the default board); also what a saved view stores. */
function boardQuery(filters: DealFilters, view: View, sort: Sort, lanes: Lanes) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (view !== "kanban") params.set("view", view);
  if (sort) params.set("sort", sort);
  if (lanes) params.set("lanes", lanes);
  return params.toString();
}

/** Reverse of boardUrl / boardQuery, from the current address by default. */
function readBoardUrl(search = window.location.search) {
  const params = new URLSearchParams(search);
  const filters = Object.fromEntries(Object.keys(NO_FILTERS).map((key) => [key, params.get(key) ?? ""])) as DealFilters;
  const view = VIEWS.find((v) => v === params.get("view")) ?? "kanban";
  const sort = params.get("sort");
  const lanes = params.get("lanes");
  return {
    filters,
    view,
    sort: (sort === "due" || sort === "priority" ? sort : null) as Sort,
    lanes: (lanes && Object.hasOwn(LANES, lanes) ? lanes : null) as Lanes,
  };
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

function matchesDue(deal: CrmDeal, due: string) {
  const date = deal.closeDate ? new Date(deal.closeDate) : null;
  // A done task is never late
  const state = deal.status === "WON" && date ? "upcoming" : dueState(date, true);
  if (due === "week") return !!date && state !== "overdue" && state !== "none" && date.toISOString().slice(0, 10) <= inAWeek();
  return state === due;
}

/** Date-only column (UTC midnight, so its ISO day is the day) inside [from, to]; no bounds = always true. */
function inDayRange(date: string | Date | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const day = date ? new Date(date).toISOString().slice(0, 10) : null;
  return !!day && !(from && day < from) && !(to && day > to);
}

/** Values of a multi-value filter ("" = none, so the filter is off) */
const listOf = (value: string) => (value ? value.split(",") : []);
const toList = (values: string[]) => values.join(",");

function matchesDeal(deal: CrmDeal, f: DealFilters) {
  const next = deal.activities?.[0];
  if (!matches(f.q, deal.title, deal.company, deal.contactName, deal.source ?? "", `#${deal.number}`)) return false;
  // A co-assignee counts as responsible for the filter
  // Several values of one filter = any of them; a co-assignee counts as responsible
  const responsibles = listOf(f.responsibleId);
  if (responsibles.length && !responsibles.includes(deal.responsible?.id ?? NO_RESPONSIBLE) && !deal.assignees?.some((m) => responsibles.includes(m.id))) return false;
  if (f.status && !listOf(f.status).includes(deal.status ?? "OPEN")) return false;
  if (f.stageId && !listOf(f.stageId).includes(deal.stageId)) return false;
  // Same overdue rule as DealCard
  if (f.activity === "overdue" && !(next?.deadline && new Date(next.deadline).getTime() < Date.now())) return false;
  if (f.activity === "none" && (deal._count?.activities ?? 0) > 0) return false;
  if ((f.from || f.to) && !deal.createdAt) return false;
  if (f.from && dayOf(deal.createdAt!) < f.from) return false;
  if (f.to && dayOf(deal.createdAt!) > f.to) return false;
  if (f.priority && !listOf(f.priority).includes(deal.priority ?? NO_PRIORITY)) return false;
  if (f.tagId && !deal.tags?.some((t) => listOf(f.tagId).includes(t.id))) return false;
  if (f.due && !matchesDue(deal, f.due)) return false;
  if (!inDayRange(deal.closeDate, f.dueFrom, f.dueTo)) return false;
  if (!inDayRange(deal.startDate, f.startFrom, f.startTo)) return false;
  if (f.overEstimate && !(deal.estimateMinutes != null && (deal.spentMinutes ?? 0) > deal.estimateMinutes)) return false;
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
      if (deal.customData && typeof deal.customData === "object") {
        (deal.customData as any).openedAt = new Date().toISOString();
      }
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
  const [lanes, setLanes] = useState<Lanes>(null);
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
    setLanes(fromUrl.lanes);
  }, []);
  useEffect(() => {
    applyQuery();
    setUrlRead(true);
  }, [applyQuery]);
  useEffect(() => {
    if (!urlRead) return;
    closeUrl.current = boardUrl(pipeline.id, filters, view, sort, lanes);
    if (window.location.pathname === "/crm") window.history.replaceState(null, "", closeUrl.current);
  }, [urlRead, pipeline.id, filters, view, sort, lanes]);
  // Swimlanes have no sync of their own: one realtime connection refreshes the board for every lane
  const lanesOn = !!lanes && view === "kanban" && isTasks;
  useEffect(() => {
    if (!lanesOn) return;
    const source = new EventSource(`/api/crm/events?pipelineId=${encodeURIComponent(pipeline.id)}`);
    source.onmessage = () => router.refresh();
    return () => source.close();
  }, [lanesOn, pipeline.id, router]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selecting, setSelecting] = useState(false);
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
  allCards.splice(0, allCards.length, ...sortCards(allCards, sort));
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

  // Swimlanes: only lanes that hold a card. A card with several tags shows in each tag lane.
  // ponytail: dragging between lanes does not change the field (each lane is its own board); edit it in the panel
  type Lane = { key: string; label: string; has: (deal: CrmDeal) => boolean };
  const laneList: Lane[] | null = (() => {
    if (!lanes || view !== "kanban" || !isTasks) return null;
    let list: Lane[];
    if (lanes === "responsible")
      list = [...responsibles, [NO_RESPONSIBLE, "Sem responsável"] as const].map(([id, name]) => ({
        key: id,
        label: name,
        has: (deal) => (deal.responsible?.id ?? NO_RESPONSIBLE) === id,
      }));
    else if (lanes === "priority")
      list = [...[...PRIORITIES].reverse(), { value: NO_PRIORITY, label: "Sem prioridade" }].map((p) => ({
        key: p.value,
        label: p.label,
        has: (deal) => (deal.priority ?? NO_PRIORITY) === p.value,
      }));
    else
      list = [
        ...tags.map((t) => ({ key: t.id, label: t.name, has: (deal: CrmDeal) => !!deal.tags?.some((x) => x.id === t.id) })),
        { key: "none", label: "Sem etiqueta", has: (deal: CrmDeal) => !deal.tags?.length },
      ];
    return list.filter((lane) => everyCard.some(lane.has));
  })();

  /** One chip per multi-value filter: "Responsável: Ana, Bia +1" */
  const listChip = (key: ListFilter, title: string, name: (value: string) => string) => {
    const values = listOf(filters[key]);
    if (!values.length) return null;
    const names = values.slice(0, 2).map(name).join(", ");
    return { key, label: `${title}: ${names}${values.length > 2 ? ` +${values.length - 2}` : ""}`, onRemove: () => set({ [key]: "" }) };
  };
  const multi = (key: ListFilter, label: string, options: { value: string; label: string }[]) => (
    <MultiSelect className="crm-access__select" aria-label={label} options={options} value={listOf(filters[key])} onChange={(values) => set({ [key]: toList(values) })} />
  );

  const chips: FilterChip[] = [
    listChip("responsibleId", "Responsável", responsibleName),
    listChip("stageId", isTasks ? "Coluna" : "Etapa", stageName),
    listChip("status", "Status", (v) => statuses[v] ?? v),
    filters.activity && { key: "activity", label: ACTIVITIES[filters.activity], onRemove: () => set({ activity: "" }) },
    listChip("priority", "Prioridade", (v) => (v === NO_PRIORITY ? "Sem prioridade" : priorityLabel(v as Priority) ?? v)),
    listChip("tagId", "Etiqueta", (v) => tags.find((t) => t.id === v)?.name ?? "Etiqueta"),
    filters.due && { key: "due", label: DUE[filters.due], onRemove: () => set({ due: "" }) },
    filters.dueFrom && { key: "dueFrom", label: `Prazo de ${showDay(filters.dueFrom)}`, onRemove: () => set({ dueFrom: "" }) },
    filters.dueTo && { key: "dueTo", label: `Prazo até ${showDay(filters.dueTo)}`, onRemove: () => set({ dueTo: "" }) },
    filters.startFrom && { key: "startFrom", label: `Início de ${showDay(filters.startFrom)}`, onRemove: () => set({ startFrom: "" }) },
    filters.startTo && { key: "startTo", label: `Início até ${showDay(filters.startTo)}`, onRemove: () => set({ startTo: "" }) },
    filters.overEstimate && { key: "overEstimate", label: "Acima da estimativa", onRemove: () => set({ overEstimate: "" }) },
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
          ["Nº", "Negócio", "Empresa", "Contato", "Origem", "Fase", "Status", "Valor (R$)", "Responsável", "Etiquetas", "Criado em"],
          ...allCards.map((c) => [
            c.number,
            c.title,
            c.company ?? "",
            c.contactName ?? "",
            c.source ?? "Direto",
            c.stageName,
            DEAL_STATUSES[c.status ?? "OPEN"] ?? c.status,
            Number(c.value).toFixed(2).replace(".", ","),
            c.responsible?.name ?? "",
            c.tags?.map((t) => t.name).join(", ") ?? "",
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
            {multi("responsibleId", "Responsável", [
              { value: NO_RESPONSIBLE, label: "Sem responsável" },
              ...responsibles.map(([value, label]) => ({ value, label })),
            ])}
          </FilterField>
          <FilterField label={isTasks ? "Coluna" : "Etapa"}>
            {multi("stageId", isTasks ? "Coluna" : "Etapa", pipeline.stages.map((s: { id: string; name: string }) => ({ value: s.id, label: s.name })))}
          </FilterField>
          <FilterField label="Status">{multi("status", "Status", Object.entries(statuses).map(([value, label]) => ({ value, label })))}</FilterField>
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
              <FilterField label="Prazo entre">
                <div className="crm-filter-panel__range">
                  <DatePicker className="crm-access__select" aria-label="Prazo de" value={filters.dueFrom} max={filters.dueTo || undefined} onChange={(e) => set({ dueFrom: e.target.value })} />
                  <span>até</span>
                  <DatePicker className="crm-access__select" aria-label="Prazo até" value={filters.dueTo} min={filters.dueFrom || undefined} onChange={(e) => set({ dueTo: e.target.value })} />
                </div>
              </FilterField>
              <FilterField label="Início entre">
                <div className="crm-filter-panel__range">
                  <DatePicker className="crm-access__select" aria-label="Início de" value={filters.startFrom} max={filters.startTo || undefined} onChange={(e) => set({ startFrom: e.target.value })} />
                  <span>até</span>
                  <DatePicker className="crm-access__select" aria-label="Início até" value={filters.startTo} min={filters.startFrom || undefined} onChange={(e) => set({ startTo: e.target.value })} />
                </div>
              </FilterField>
              <FilterField label="Tempo">
                <Select className="crm-access__select" value={filters.overEstimate} onChange={(e) => set({ overEstimate: e.target.value })} aria-label="Tempo">
                  <option value="">Todos</option>
                  <option value="1">Acima da estimativa</option>
                </Select>
              </FilterField>
              <FilterField label="Prioridade">
                {multi("priority", "Prioridade", [
                  ...[...PRIORITIES].reverse().map((p) => ({ value: p.value, label: p.label })),
                  { value: NO_PRIORITY, label: "Sem prioridade" },
                ])}
              </FilterField>
              {tags.length > 0 && <FilterField label="Etiqueta">{multi("tagId", "Etiqueta", tags.map((t) => ({ value: t.id, label: t.name })))}</FilterField>}
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
        {!isTasks && (
          <div className="crm-quick-sources" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 2px" }}>
            <button
              type="button"
              className={`view-btn ${filters.q === "Evento" ? "is-active" : ""}`}
              onClick={() => set({ q: filters.q === "Evento" ? "" : "Evento" })}
              title="Filtrar leads de eventos"
              style={{ fontSize: "0.78rem", padding: "6px 11px", height: "auto" }}
            >
              🎪 Eventos
            </button>
            <button
              type="button"
              className={`view-btn ${filters.q === "Site" ? "is-active" : ""}`}
              onClick={() => set({ q: filters.q === "Site" ? "" : "Site" })}
              title="Filtrar leads do site"
              style={{ fontSize: "0.78rem", padding: "6px 11px", height: "auto" }}
            >
              🌐 Site
            </button>
            <button
              type="button"
              className={`view-btn ${filters.q === "Quiz" ? "is-active" : ""}`}
              onClick={() => set({ q: filters.q === "Quiz" ? "" : "Quiz" })}
              title="Filtrar leads do quiz"
              style={{ fontSize: "0.78rem", padding: "6px 11px", height: "auto" }}
            >
              🧩 Quiz
            </button>
            <button
              type="button"
              className="view-btn"
              onClick={exportCsv}
              disabled={allCards.length === 0}
              title="Exportar leads filtrados para CSV (Excel)"
              style={{ fontSize: "0.78rem", padding: "6px 11px", height: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        )}
        <CrmSavedViews pipelineId={pipeline.id} query={boardQuery(filters, view, sort, lanes)} onApply={applyQuery} />
        {view === "kanban" && (
          <button
            type="button"
            className={`view-btn ${selecting ? "is-active" : ""}`}
            title="Selecionar cards para ações em massa"
            aria-label="Selecionar cards"
            onClick={() => {
              setSelected(new Set());
              setSelecting((s) => !s);
            }}
          >
            <CheckSquare size={16} />
          </button>
        )}
        {view === "kanban" && isTasks && (
          <Select className="crm-access__select crm-toolbar__sort" value={sort ?? ""} onChange={(e) => setSort((e.target.value || null) as Sort)} aria-label="Ordem dos cards">
            <option value="">Ordem manual</option>
            <option value="due">Por prazo</option>
            <option value="priority">Por prioridade</option>
          </Select>
        )}
        {view === "kanban" && isTasks && (
          <Select className="crm-access__select crm-toolbar__sort" value={lanes ?? ""} onChange={(e) => setLanes((e.target.value || null) as Lanes)} aria-label="Raias">
            <option value="">Sem raias</option>
            {Object.entries(LANES).map(([value, label]) => (
              <option key={value} value={value}>
                Raias: {label.toLowerCase()}
              </option>
            ))}
          </Select>
        )}
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
          {isTasks && (
            <button className={`view-btn ${view === "workload" ? "is-active" : ""}`} onClick={() => setView("workload")}>
              <Users size={16} /> Carga
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
        {(view === "kanban" || view === "list") && (
          <CrmFunnelSummary pipeline={pipeline} deals={allCards} isTasks={isTasks} />
        )}
        {view === "kanban" && (
          <>
            {selecting && (
              <CrmBulkBar
                ids={selectedIds}
                stages={pipeline.stages}
                isTasks={isTasks}
                archived={false}
                onDone={() => {
                  setSelected(new Set());
                  setSelecting(false);
                }}
              />
            )}
            {laneList ? (
              laneList.map((lane, i) => (
                <section key={lane.key} className="crm-lane">
                  <h3 className="crm-lane__title">
                    {lane.label} <span>{allCards.filter(lane.has).length}</span>
                  </h3>
                  <CrmKanban
                    pipeline={pipeline}
                    onOpenDeal={openDeal}
                    syncBoardRef={syncBoardRef}
                    isDealVisible={(deal) => lane.has(deal) && (!filtering || isDealVisible(deal))}
                    sort={sort}
                    selected={selecting ? selected : undefined}
                    onToggleSelect={selecting ? toggle : undefined}
                    lane={i === 0 ? "first" : "rest"}
                  />
                </section>
              ))
            ) : (
              <CrmKanban
                pipeline={pipeline}
                onOpenDeal={openDeal}
                syncBoardRef={syncBoardRef}
                isDealVisible={filtering ? isDealVisible : undefined}
                sort={sort}
                selected={selecting ? selected : undefined}
                onToggleSelect={selecting ? toggle : undefined}
              />
            )}
          </>
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

        {view === "workload" && <CrmWorkload cards={allCards} onOpen={openDeal} />}

        {view === "calendar" && (
          <CrmCalendar
            undated={allCards.filter((c) => !c.closeDate).length}
            items={allCards.flatMap((card) =>
              card.closeDate
                ? [
                    {
                      key: card.id,
                      day: new Date(card.closeDate).toISOString().slice(0, 10),
                      time: card.dueTime ?? null,
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
