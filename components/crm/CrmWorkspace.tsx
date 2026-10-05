"use client";

import { useCallback, useState } from "react";
import { CrmKanban } from "./CrmKanban";
import type { CrmDeal } from "./DealCard";
import { FilterField, FilterSearch, type FilterChip } from "./FilterSearch";
import { Select } from "@/components/ui/Select";
import { matches } from "@/lib/text-search";
import { Kanban, List, Calendar, TrendingUp } from "lucide-react";

type DealFilters = { q: string; responsibleId: string; status: string; activity: string; from: string; to: string };
const NO_FILTERS: DealFilters = { q: "", responsibleId: "", status: "", activity: "", from: "", to: "" };
const NO_RESPONSIBLE = "none";
const STATUSES: Record<string, string> = { OPEN: "Aberto", WON: "Ganho", LOST: "Perdido" };
const ACTIVITIES: Record<string, string> = { overdue: "Atividade atrasada", none: "Sem atividade pendente" };

/** Local YYYY-MM-DD, comparable with <input type="date"> values. */
const dayOf = (date: string | Date) => new Date(date).toLocaleDateString("sv-SE");
/** YYYY-MM-DD → DD/MM/YYYY */
const showDay = (day: string) => day.split("-").reverse().join("/");

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
  return true;
}

export function CrmWorkspace({ pipeline, initialDealId }: { pipeline: any; initialDealId?: string }) {
  const [view, setView] = useState<"kanban" | "list" | "activities">("kanban");
  const [filters, setFilters] = useState(NO_FILTERS);
  const set = (changes: Partial<DealFilters>) => setFilters((f) => ({ ...f, ...changes }));
  const filtering = Object.values(filters).some(Boolean);
  const isDealVisible = useCallback((deal: CrmDeal) => matchesDeal(deal, filters), [filters]);

  // Collect all cards across all stages for list and activity views
  const everyCard = pipeline.stages.flatMap((stage: any) =>
    stage.cards.map((card: any) => ({ ...card, stageName: stage.name }))
  );
  const allCards = everyCard.filter(isDealVisible);
  const emptyMessage = filtering ? "Nenhum negócio corresponde aos filtros." : null;

  const responsibles = [
    ...new Map((everyCard as CrmDeal[]).flatMap((c) => (c.responsible ? [[c.responsible.id, c.responsible.name] as const] : []))),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const responsibleName = (id: string) =>
    id === NO_RESPONSIBLE ? "Sem responsável" : responsibles.find(([rid]) => rid === id)?.[1] ?? "Responsável";

  const chips: FilterChip[] = [
    filters.responsibleId && { key: "responsible", label: responsibleName(filters.responsibleId), onRemove: () => set({ responsibleId: "" }) },
    filters.status && { key: "status", label: STATUSES[filters.status], onRemove: () => set({ status: "" }) },
    filters.activity && { key: "activity", label: ACTIVITIES[filters.activity], onRemove: () => set({ activity: "" }) },
    filters.from && { key: "from", label: `Criado de ${showDay(filters.from)}`, onRemove: () => set({ from: "" }) },
    filters.to && { key: "to", label: `Criado até ${showDay(filters.to)}`, onRemove: () => set({ to: "" }) },
  ].filter((c): c is FilterChip => Boolean(c));

  return (
    <>
      <div className="crm-toolbar">
        <FilterSearch
          value={filters.q}
          onChange={(q) => set({ q })}
          placeholder="Buscar por negócio, empresa, contato ou #nº"
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
              {Object.entries(STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
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
          <FilterField label="Data de criação">
            <div className="crm-filter-panel__range">
              <input type="date" className="crm-access__select" aria-label="Criado de" value={filters.from} max={filters.to || undefined} onChange={(e) => set({ from: e.target.value })} />
              <span>até</span>
              <input type="date" className="crm-access__select" aria-label="Criado até" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} />
            </div>
          </FilterField>
        </FilterSearch>
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
          <button 
            className={`view-btn ${view === "activities" ? "is-active" : ""}`}
            onClick={() => setView("activities")}
          >
            <Calendar size={16} /> Atividades
          </button>
        </div>
      </div>

      <div className="crm-content">
        {view === "kanban" && <CrmKanban pipeline={pipeline} initialDealId={initialDealId} isDealVisible={filtering ? isDealVisible : undefined} />}

        {view === "list" && (
          <div className="crm-list-view">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Negócio</th>
                  <th>Empresa</th>
                  <th>Fase</th>
                  <th>Valor</th>
                  <th>Data de Criação</th>
                </tr>
              </thead>
              <tbody>
                {allCards.map((card: any) => (
                  <tr key={card.id}>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{card.title}</td>
                    <td>{card.company || "—"}</td>
                    <td>
                      <span className="crm-badge">{card.stageName}</span>
                    </td>
                    <td style={{ color: '#4ceb95', fontWeight: 600 }}>
                      R$ {Number(card.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td>{new Date(card.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
                {allCards.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#a5a0aa" }}>
                      {emptyMessage ?? "Nenhum negócio encontrado neste pipeline."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === "activities" && (
          <div className="crm-activities-view">
            <div className="crm-activities-header">
              <h3>Histórico de Movimentações</h3>
              <p>Acompanhe as atualizações recentes e o pulso das suas vendas.</p>
            </div>
            
            <div className="crm-timeline">
              {allCards
                .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((card: any, idx: number) => (
                  <div className="crm-timeline-item" key={`${card.id}-${idx}`}>
                    <div className="crm-timeline-icon">
                      <TrendingUp size={16} />
                    </div>
                    <div className="crm-timeline-content">
                      <div className="crm-timeline-title">
                        Negócio <strong>{card.title}</strong> atualizado para a fase <span className="crm-badge">{card.stageName}</span>
                      </div>
                      <div className="crm-timeline-time">
                        {new Date(card.updatedAt).toLocaleString('pt-BR')}
                      </div>
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
    </>
  );
}
