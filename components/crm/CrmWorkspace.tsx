"use client";

import { useState } from "react";
import KanbanBoard from "@/components/KanbanBoard";
import { Search, Kanban, List, Calendar, TrendingUp } from "lucide-react";
import { CardDetailsModal } from "./CardDetailsModal";

export function CrmWorkspace({ pipeline }: { pipeline: any }) {
  const [view, setView] = useState<"kanban" | "list" | "activities">("kanban");
  const [detailedCardId, setDetailedCardId] = useState<string | null>(null);

  // Collect all cards across all stages for list and activity views
  const allCards = pipeline.stages.flatMap((stage: any) => 
    stage.cards.map((card: any) => ({ ...card, stageName: stage.name }))
  );

  return (
    <>
      <div className="crm-toolbar">
        <div className="crm-toolbar__search">
          <Search size={18} />
          <input type="text" placeholder="Buscar no CRM..." />
        </div>
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
        {view === "kanban" && <KanbanBoard pipeline={pipeline} onCardClick={setDetailedCardId} />}

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
                  <tr key={card.id} onClick={() => setDetailedCardId(card.id)} style={{ cursor: 'pointer' }}>
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
                      Nenhum negócio encontrado neste pipeline.
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
                <div style={{ color: "#a5a0aa", marginTop: "20px" }}>Sem histórico de atividades.</div>
              )}
            </div>
          </div>
        )}
      </div>

      {detailedCardId && (
        <CardDetailsModal 
          cardId={detailedCardId} 
          pipeline={pipeline} 
          onClose={() => setDetailedCardId(null)} 
        />
      )}
    </>
  );
}
