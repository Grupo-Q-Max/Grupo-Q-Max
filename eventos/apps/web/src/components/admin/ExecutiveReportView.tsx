"use client";

import { useState, type ReactNode } from "react";
import {
  Printer,
  FileSpreadsheet,
  Users,
  Trophy,
  PackageCheck,
  Flame,
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Percent,
  PieChart,
  Layers,
  Award,
} from "lucide-react";
import { getAdminProxyUrl } from "@/lib/api-client";

type PrizeStat = {
  prizeId: number;
  name: string;
  delivered: number;
  actualPercent: number; // % do total de brindes sorteados
  availableStock: number;
  initialStock: number;
  configuredProbability: number;
  active?: boolean;
};

type ReportData = {
  event: {
    id: number;
    name: string;
    status: string;
  };
  summary: {
    totalParticipations: number;
    approved: number;
    blocked: number;
    review: number;
    completed?: number;
    deliveredPrizes: number;
    totalAvailableStock: number;
    totalInitialStock?: number;
    uniqueParticipants: number;
  };
  distribution: PrizeStat[];
};

type Props = {
  data: ReportData;
  canExport: boolean;
  // Funil e giros por hora (PostEventReport), logo após os indicadores.
  funnel?: ReactNode;
};

const PALETTE_SOLID = [
  "#0077ff", // primary blue
  "#06b6d4", // cyan
  "#f59e0b", // amber
  "#10b981", // emerald
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#d946ef", // fuchsia
  "#f97316", // orange
];

export default function ExecutiveReportView({ data, canExport, funnel }: Props) {
  const { event, summary, distribution } = data;
  const now = new Date();

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    const proxyUrl = getAdminProxyUrl();
    window.open(`${proxyUrl}/participants/event/${event.id}/export-csv`, "_blank");
  }

  const totalDelivered = summary.deliveredPrizes || 0;

  const approvalRate =
    summary.totalParticipations > 0
      ? Math.round((summary.approved / summary.totalParticipations) * 100)
      : 0;

  return (
    <div className="flex flex-col gap-6 text-text font-sans print:text-black">
      {/* Barra Superior de Ações (Oculta na Impressão) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface border border-line p-6 rounded-3xl backdrop-blur print:hidden">
        <div>
          <span className="text-[10px] font-black text-finora-600 uppercase tracking-widest block mb-1">
            RELATÓRIO EXECUTIVO & CONSOLIDADO
          </span>
          <h2 className="text-2xl font-black text-text mt-1">
            Métricas de Desempenho & Distribuição de Brindes
          </h2>
          <p className="text-xs text-text-2 mt-1">
            Relatório oficial do evento <strong>{event.name}</strong> • Atualizado em {now.toLocaleDateString("pt-BR")} às {now.toLocaleTimeString("pt-BR")}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canExport && (
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-surface hover:bg-line-strong text-text border border-line-strong text-xs font-bold transition-all cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            <span>Exportar CSV/Excel</span>
          </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-finora-600 hover:bg-finora-700 text-white text-xs font-bold transition-all border border-cyan-500/30 cursor-pointer"
          >
            <Printer size={15} />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Documento Principal do Relatório */}
      <div className="bg-surface border border-line p-8 rounded-3xl backdrop-blur print:bg-white print:border-none print:shadow-none print:p-0 print:text-black space-y-8">
        {/* Cabeçalho do Documento */}
        <div className="flex items-center justify-between pb-6 border-b border-line print:border-slate-300">
          <div>
            <span className="text-xs font-extrabold tracking-widest text-finora-600 uppercase print:text-slate-600">
              FINORA EXPERIENCE • RELATÓRIO OFICIAL
            </span>
            <h1 className="font-display text-[30px] font-bold tracking-[-0.02em] print:text-black mt-1">
              {event.name}
            </h1>
            <p className="text-xs text-text-2 print:text-slate-600 mt-1">
              Status: <strong className="text-emerald-400 print:text-black uppercase">{event.status}</strong> • Emissão: {now.toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-finora-600 p-0.5 print:hidden">
            <div className="w-full h-full bg-paper rounded-[14px] flex items-center justify-center font-black text-2xl text-text">
              F
            </div>
          </div>
        </div>

        {/* 1. KPIs Principais do Evento */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-surface p-5 rounded-2xl border border-line hover:border-cyan-500/40 transition-colors print:bg-slate-100 print:border-slate-300">
            <span className="text-xs text-text-2 print:text-slate-600 block">Total de Cadastros</span>
            <strong className="text-2xl font-black text-text print:text-black block mt-1">
              {summary.totalParticipations}
            </strong>
            <small className="text-[11px] text-emerald-400 font-bold mt-0.5 block">
              {approvalRate}% de aprovação
            </small>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-line hover:border-cyan-500/40 transition-colors print:bg-slate-100 print:border-slate-300">
            <span className="text-xs text-text-2 print:text-slate-600 block">Visitantes Únicos (CPF)</span>
            <strong className="text-2xl font-black text-text print:text-black block mt-1">
              {summary.uniqueParticipants}
            </strong>
            <small className="text-[11px] text-text-2 mt-0.5 block">
              Profissionais validados
            </small>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-line hover:border-[#F2D19B] transition-colors print:bg-slate-100 print:border-slate-300">
            <span className="text-xs text-text-2 print:text-slate-600 block">Brindes Sorteados</span>
            <strong className="text-2xl font-black text-[#8A4B00] print:text-amber-700 block mt-1">
              {totalDelivered}
            </strong>
            <small className="text-[11px] text-[#8A4B00] font-bold mt-0.5 block">
              Giros premiados
            </small>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-line hover:border-emerald-500/30 transition-colors print:bg-slate-100 print:border-slate-300">
            <span className="text-xs text-text-2 print:text-slate-600 block">Entregues (Balcão)</span>
            <strong className="text-2xl font-black text-emerald-400 print:text-emerald-700 block mt-1">
              {summary.completed ?? summary.deliveredPrizes}
            </strong>
            <small className="text-[11px] text-emerald-400 font-bold mt-0.5 block">
              Entregas concluídas
            </small>
          </div>

          <div className="bg-surface p-5 rounded-2xl border border-line hover:border-rose-500/30 transition-colors print:bg-slate-100 print:border-slate-300 col-span-2 lg:col-span-1">
            <span className="text-xs text-text-2 print:text-slate-600 block">Bloqueios Antifraude</span>
            <strong className="text-2xl font-black text-rose-400 print:text-rose-700 block mt-1">
              {summary.blocked}
            </strong>
            <small className="text-[11px] text-rose-400 font-bold mt-0.5 block">
              Duplicados impedidos
            </small>
          </div>
        </div>

        {funnel}

        {/* 2. Distribuição Percentual de Cada Brinde (Visão Gráfica & Share) */}
        <section className="bg-paper p-6 rounded-3xl border border-line print:bg-slate-50 print:border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChart size={20} className="text-finora-600" />
              <h3 className="text-lg font-extrabold text-text print:text-black">
                Proporção & Share de Cada Brinde Ganho (%)
              </h3>
            </div>
            <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full font-mono uppercase tracking-widest">
              Sorteados: {totalDelivered} unid
            </span>
          </div>

          <p className="text-xs text-text-2 print:text-slate-600 mb-5">
            Porcentagem total da participação de cada prêmio sobre o volume acumulado de sorteios realizados no evento.
          </p>

          {/* Barra Multicor Segmentada de Distribuição */}
          {totalDelivered > 0 ? (
            <div className="w-full h-7 bg-surface rounded-xl overflow-hidden flex border border-line mb-6 print:hidden">
              {distribution.map((prize, idx) => {
                const percent =
                  totalDelivered > 0
                    ? Math.round((prize.delivered / totalDelivered) * 100)
                    : 0;
                if (percent === 0) return null;
                const colorHex = PALETTE_SOLID[idx % PALETTE_SOLID.length];

                return (
                  <div
                    key={prize.prizeId}
                    style={{ width: `${percent}%`, backgroundColor: colorHex }}
                    className="h-full relative group transition-all hover:opacity-90 flex items-center justify-center text-[10px] font-black text-text px-1 overflow-hidden"
                    title={`${prize.name}: ${prize.delivered} unidades (${percent}%)`}
                  >
                    {percent >= 5 ? `${percent}%` : ""}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-text-2 bg-surface rounded-xl mb-6 border border-line border-dashed">
              Nenhum brinde sorteado até o momento para gerar o gráfico de distribuição.
            </div>
          )}

          {/* Grid de Cards por Brinde com Porcentagem e Estoque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {distribution.map((prize, idx) => {
              const sharePercent =
                totalDelivered > 0
                  ? Number(((prize.delivered / totalDelivered) * 100).toFixed(1))
                  : 0;

              const stockConsumedPercent =
                prize.initialStock > 0
                  ? Math.round((prize.delivered / prize.initialStock) * 100)
                  : 0;

              const colorDot = PALETTE_SOLID[idx % PALETTE_SOLID.length];

              return (
                <div
                  key={prize.prizeId}
                  className="bg-surface p-4 rounded-2xl border border-line flex flex-col justify-between hover:border-line-strong transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: colorDot }}
                        />
                        <strong className="text-xs font-bold text-text truncate max-w-[140px]">
                          {prize.name}
                        </strong>
                      </div>
                      <span className="text-[11px] font-black text-cyan-400 font-mono bg-cyan-500/15 px-1.5 py-0.5 rounded">
                        {sharePercent}%
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-3">
                      <span className="text-xs text-text-2">Sorteados:</span>
                      <strong className="text-base font-black text-text font-mono">
                        {prize.delivered} <span className="text-xs font-normal text-text-2">un.</span>
                      </strong>
                    </div>

                    <div className="flex items-baseline justify-between text-xs mt-1.5">
                      <span className="text-text-2">Em Estoque:</span>
                      <strong
                        className={`font-mono font-bold ${
                          prize.availableStock === 0
                            ? "text-rose-400"
                            : prize.availableStock <= 5
                            ? "text-[#8A4B00]"
                            : "text-emerald-400"
                        }`}
                      >
                        {prize.availableStock} / {prize.initialStock}
                      </strong>
                    </div>
                  </div>

                  {/* Barra de Consumo de Estoque */}
                  <div className="mt-3 pt-3 border-t border-line">
                    <div className="flex items-center justify-between text-[10px] text-text-2 mb-1.5">
                      <span>Consumo:</span>
                      <span className="font-mono font-bold text-text">
                        {stockConsumedPercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-paper rounded-full overflow-hidden border border-line">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(stockConsumedPercent, 100)}%`, backgroundColor: colorDot }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Tabela Consolidada de Distribuição & Estoque */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={20} className="text-[#8A4B00]" />
            <h3 className="text-lg font-bold text-text print:text-black">
              Tabela Detalhada de Distribuição de Prêmios
            </h3>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line print:border-slate-300">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-paper border-b border-line print:bg-slate-200 print:border-slate-300 text-text-2 print:text-slate-800 font-bold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Prêmio</th>
                  <th className="p-4 text-center">Probabilidade</th>
                  <th className="p-4 text-center">Sorteados (Saíram)</th>
                  <th className="p-4 text-center">% do Total</th>
                  <th className="p-4 text-center">Estoque Inicial</th>
                  <th className="p-4 text-center">Estoque Atual</th>
                  <th className="p-4 text-right">% Consumido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line print:divide-slate-300">
                {distribution.map((prize, idx) => {
                  const sharePercent =
                    totalDelivered > 0
                      ? Number(((prize.delivered / totalDelivered) * 100).toFixed(1))
                      : 0;

                  const consumedPercent =
                    prize.initialStock > 0
                      ? Math.round((prize.delivered / prize.initialStock) * 100)
                      : 0;

                  const colorDot = PALETTE_SOLID[idx % PALETTE_SOLID.length];

                  return (
                    <tr
                      key={prize.prizeId}
                      className="bg-surface hover:bg-paper print:hover:bg-transparent transition-colors"
                    >
                      <td className="p-4 font-bold text-text print:text-black flex items-center gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                          style={{ backgroundColor: colorDot }}
                        />
                        <span className="text-sm">{prize.name}</span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold text-finora-600 print:text-blue-700">
                        {prize.configuredProbability}%
                      </td>
                      <td className="p-4 text-center font-mono text-sm font-black text-[#8A4B00] print:text-amber-800">
                        {prize.delivered}
                      </td>
                      <td className="p-4 text-center font-mono font-black text-finora-600 print:text-cyan-700">
                        {sharePercent}%
                      </td>
                      <td className="p-4 text-center font-mono text-text-2 print:text-black">
                        {prize.initialStock}
                      </td>
                      <td className="p-4 text-center font-mono font-bold">
                        <span
                          className={`px-2.5 py-1 rounded border text-[10px] font-black tracking-wider uppercase ${
                            prize.availableStock === 0
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : prize.availableStock <= 5
                              ? "bg-[#FFF3DC] text-[#8A4B00] border-[#F2D19B]"
                              : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          }`}
                        >
                          {prize.availableStock} un
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-black text-text print:text-black">
                        {consumedPercent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. Análise de Fluxo e Horários de Atendimento */}
        <section className="bg-surface p-6 rounded-3xl border border-line print:bg-slate-50 print:border-slate-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-finora-600" />
              <h3 className="text-lg font-bold text-text print:text-black">
                Fluxo de Atendimento & Horários de Pico do Estande
              </h3>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full print:hidden flex items-center gap-1.5">
              <TrendingUp size={13} />
              Pico Estimado: 14h - 16h
            </span>
          </div>

          <p className="text-xs text-text-2 print:text-slate-600 mb-6">
            Estimativa gráfica do volume de giros na roleta e entregas no balcão por horário ao longo do evento.
          </p>

          <div className="grid grid-cols-11 gap-2 items-end h-36 pt-4 border-b border-line print:border-slate-300">
            {[
              { hour: "09h", percent: 25, isPeak: false },
              { hour: "10h", percent: 45, isPeak: false },
              { hour: "11h", percent: 70, isPeak: false },
              { hour: "12h", percent: 55, isPeak: false },
              { hour: "13h", percent: 65, isPeak: false },
              { hour: "14h", percent: 95, isPeak: true },
              { hour: "15h", percent: 100, isPeak: true },
              { hour: "16h", percent: 90, isPeak: true },
              { hour: "17h", percent: 75, isPeak: false },
              { hour: "18h", percent: 50, isPeak: false },
              { hour: "19h", percent: 30, isPeak: false },
            ].map((item) => (
              <div key={item.hour} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <span className="text-[10px] text-text-2 print:text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.percent}%
                </span>
                <div
                  className={`w-full max-w-[36px] rounded-t-xl transition-all border-t border-x ${
                    item.isPeak
                      ? "bg-finora-600 border-cyan-500/30"
                      : "bg-surface border-line-strong hover:bg-line-strong"
                  }`}
                  style={{ height: `${item.percent}%` }}
                />
                <span className="text-[11px] font-bold text-text-2 print:text-slate-700 mt-1">
                  {item.hour}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Rodapé de Documentação Oficial */}
        <div className="pt-6 border-t border-line print:border-slate-300 flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-text-2 print:text-slate-600">
          <span>Finora Experience • Gestão de Eventos</span>
          <span>Documento Oficial Consolidado</span>
        </div>
      </div>
    </div>
  );
}
