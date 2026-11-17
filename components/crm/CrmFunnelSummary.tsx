"use client";

import { useMemo, useState } from "react";
import type { CrmDeal } from "./DealCard";
import { ChevronDown, ChevronUp, Layers, TrendingUp, Users } from "lucide-react";

type Stage = {
  id: string;
  name: string;
  color?: string | null;
  order?: number;
};

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
};

export function CrmFunnelSummary({
  pipeline,
  deals,
  isTasks = false,
}: {
  pipeline: Pipeline;
  deals: CrmDeal[];
  isTasks?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const stats = useMemo(() => {
    const totalDeals = deals.length;
    const totalValue = deals.reduce((acc, d) => acc + (Number(d.value) || 0), 0);

    // Contagem por estágio
    const stageCounts: Record<string, { count: number; value: number }> = {};
    for (const stage of pipeline.stages) {
      stageCounts[stage.id] = { count: 0, value: 0 };
    }

    for (const deal of deals) {
      if (stageCounts[deal.stageId]) {
        stageCounts[deal.stageId].count += 1;
        stageCounts[deal.stageId].value += Number(deal.value) || 0;
      }
    }

    const stagesWithStats = pipeline.stages.map((stage) => {
      const data = stageCounts[stage.id] || { count: 0, value: 0 };
      const pct = totalDeals > 0 ? (data.count / totalDeals) * 100 : 0;
      return {
        ...stage,
        count: data.count,
        value: data.value,
        pct,
      };
    });

    // Deals ganhos vs perdidos vs em aberto
    const wonCount = deals.filter((d) => d.status === "WON").length;
    const conversionRate = totalDeals > 0 ? (wonCount / totalDeals) * 100 : 0;

    return {
      totalDeals,
      totalValue,
      stagesWithStats,
      wonCount,
      conversionRate,
    };
  }, [pipeline.stages, deals]);

  if (deals.length === 0) return null;

  return (
    <div
      className="crm-funnel-summary"
      style={{
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "14px",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", color: "rgba(255, 255, 255, 0.85)", fontWeight: 600 }}>
            <Layers size={15} style={{ color: "var(--qmax-primary, #10b981)" }} />
            <span>Funil de Conversão</span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255, 255, 255, 0.5)", fontWeight: 400 }}>({pipeline.name})</span>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", fontSize: "0.78rem" }}>
            <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
              Total: <strong style={{ color: "#fff" }}>{stats.totalDeals}</strong> {isTasks ? "tarefas" : "leads"}
            </span>

            {!isTasks && stats.totalValue > 0 && (
              <span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
                Pipeline:{" "}
                <strong style={{ color: "#10b981" }}>
                  {stats.totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </span>
            )}

            {!isTasks && stats.wonCount > 0 && (
              <span style={{ color: "rgba(255, 255, 255, 0.6)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <TrendingUp size={13} style={{ color: "#10b981" }} />
                Conversão Ganha: <strong style={{ color: "#10b981" }}>{stats.conversionRate.toFixed(1)}%</strong>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(255, 255, 255, 0.5)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "0.72rem",
            padding: "4px 8px",
            borderRadius: "4px",
          }}
          title={collapsed ? "Expandir funil" : "Recolher funil"}
        >
          {collapsed ? (
            <>
              Mostrar estágios <ChevronDown size={14} />
            </>
          ) : (
            <>
              Recolher <ChevronUp size={14} />
            </>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Barra proporcional visual */}
          <div
            style={{
              display: "flex",
              height: "6px",
              width: "100%",
              borderRadius: "3px",
              overflow: "hidden",
              margin: "10px 0 8px",
              background: "rgba(255, 255, 255, 0.05)",
            }}
          >
            {stats.stagesWithStats.map((st) =>
              st.pct > 0 ? (
                <div
                  key={st.id}
                  style={{
                    width: `${st.pct}%`,
                    backgroundColor: st.color || "#3b82f6",
                    transition: "width 0.3s ease",
                  }}
                  title={`${st.name}: ${st.count} (${st.pct.toFixed(1)}%)`}
                />
              ) : null
            )}
          </div>

          {/* Cards dos estágios */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fit, minmax(130px, 1fr))`,
              gap: "8px",
              marginTop: "8px",
            }}
          >
            {stats.stagesWithStats.map((st, idx) => (
              <div
                key={st.id}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderTop: `2px solid ${st.color || "#3b82f6"}`,
                  borderRadius: "6px",
                  padding: "6px 8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "rgba(255, 255, 255, 0.7)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={st.name}
                >
                  {st.name}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff" }}>{st.count}</span>
                  <span style={{ fontSize: "0.68rem", color: "rgba(255, 255, 255, 0.4)" }}>
                    {st.pct.toFixed(0)}%
                  </span>
                </div>
                {!isTasks && st.value > 0 && (
                  <div style={{ fontSize: "0.65rem", color: "rgba(255, 255, 255, 0.45)" }}>
                    {st.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

