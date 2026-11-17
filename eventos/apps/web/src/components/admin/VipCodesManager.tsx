"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { Crown, Sparkles, X, Printer, Eye, Archive, Loader2, Download } from "lucide-react";

import { ui } from "@/components/form/Paper";
import { getAdminProxyUrl } from "@/lib/api-client";
import GoldenTicket from "@/components/brand/GoldenTicket";
import { exportAllTicketsToZip } from "@/lib/ticket-export";

type VipCode = {
  id: number;
  code: string;
  createdAt: string;
  redeemedAt: string | null;
  participantName: string | null;
  prizeName: string | null;
};

type VipCodesResponse = {
  total: number;
  used: number;
  available: number;
  codes: VipCode[];
};

async function fetchCodes(eventId: number): Promise<VipCodesResponse> {
  const res = await fetch(`${getAdminProxyUrl()}/vip-codes/event/${eventId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Não foi possível carregar os códigos (${res.status}).`);
  return res.json();
}

export default function VipCodesManager({
  eventId,
  eventName,
  eventSlug,
}: {
  eventId: number;
  eventName: string;
  eventSlug: string;
}) {
  const [data, setData] = useState<VipCodesResponse | null>(null);
  const [quantity, setQuantity] = useState("50");
  const [format, setFormat] = useState<"NUMERIC" | "ALPHANUMERIC">("NUMERIC");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<VipCode | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    fetchCodes(eventId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar códigos."));
  }, [eventId]);

  async function generate() {
    setError(null);
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 5000) {
      setError("Informe uma quantidade entre 1 e 5000.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${getAdminProxyUrl()}/vip-codes/event/${eventId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty, format }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Não foi possível gerar os códigos.");
      setData(await fetchCodes(eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar códigos.");
    } finally {
      setBusy(false);
    }
  }

  function exportXlsx() {
    if (!data) return;
    const origin =
      typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
        ? window.location.origin
        : "https://grupoqmax.com.br";
    const base = `${origin}/finora-experience/${eventSlug}/cadastro?vip=`;
    const rows = data.codes.map((c) => ({
      Numero_Bilhete: c.code.startsWith("#") ? c.code : `#${c.code}`,
      Codigo: c.code,
      Link_QRCode_Ativacao: `${base}${encodeURIComponent(c.code)}`,
      Situacao: c.redeemedAt ? "Usado" : "Livre",
      UsadoEm: c.redeemedAt ? new Date(c.redeemedAt).toLocaleString("pt-BR") : "",
      Mentorado_Participante: c.participantName ?? "",
      Premio_VIP_Sorteado: c.prizeName ?? "",
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Bilhetes VIP");
    XLSX.writeFile(book, `bilhetes-vip-${eventName.replace(/\W+/g, "-").toLowerCase()}.xlsx`);
  }

  async function handleExportZip() {
    if (!data || !data.codes.length) return;
    setError(null);
    setExportingZip(true);
    setExportProgress({ current: 0, total: data.codes.length });

    try {
      await exportAllTicketsToZip(data.codes, eventName, eventSlug, (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao exportar bilhetes em ZIP.");
    } finally {
      setExportingZip(false);
      setExportProgress(null);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Bilhetes Gerados", data?.total, "text-text"],
          ["Bilhetes Usados", data?.used, "text-emerald-600"],
          ["Bilhetes Livres", data?.available, "text-[#B8860B]"],
        ].map(([label, value, colorClass]) => (
          <div key={label as string} className={`${ui.card} p-5`}>
            <span className={ui.eyebrow}>{label}</span>
            <strong className={`mt-1 block text-3xl font-black ${colorClass}`}>{value ?? "—"}</strong>
          </div>
        ))}
      </div>

      {/* Barra de Ações: Gerar e Exportar */}
      <div className={`${ui.card} flex flex-wrap items-end justify-between gap-4 p-5`}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex w-32 flex-col gap-1.5 text-xs font-bold text-text-2 uppercase tracking-wider">
            Qtd. a Gerar
            <input
              type="number"
              min={1}
              max={5000}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={ui.input}
            />
          </label>

          <label className="flex w-52 flex-col gap-1.5 text-xs font-bold text-text-2 uppercase tracking-wider">
            Formato do Código
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className={ui.input}
            >
              <option value="NUMERIC">🔢 Numérico (ex: 1001, 1002)</option>
              <option value="ALPHANUMERIC">🔤 Alfanumérico (ex: 8J4P2K)</option>
            </select>
          </label>

          <button type="button" className={ui.primary} disabled={busy} onClick={generate}>
            {busy ? "Gerando…" : "Gerar novos bilhetes"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {data?.codes?.[0] && (
            <button
              type="button"
              onClick={() => setSelectedTicket(data.codes[0])}
              className="flex items-center gap-1.5 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#FFF5C0] to-[#FFE082] px-4 py-2 text-xs font-black text-[#5C4000] shadow-sm hover:brightness-105 cursor-pointer"
            >
              <Crown size={14} className="text-[#B8860B]" />
              <span>Visualizar Modelo do Bilhete</span>
            </button>
          )}

          <button type="button" className={ui.pill} disabled={!data?.total} onClick={exportXlsx}>
            Exportar planilha (.xlsx)
          </button>

          <button
            type="button"
            disabled={!data?.total || exportingZip}
            onClick={handleExportZip}
            className="flex items-center gap-2 rounded-full border border-[#D4AF37] bg-gradient-to-r from-[#F7E7A9] via-[#E5C158] to-[#B8860B] px-4 py-2 text-xs font-black text-[#0C1222] shadow-sm hover:brightness-110 active:scale-95 disabled:opacity-50 cursor-pointer transition-all"
            title="Gera e empacota em ZIP as imagens em alta resolução de todos os bilhetes VIP"
          >
            {exportingZip ? (
              <>
                <Loader2 size={14} className="animate-spin text-[#0C1222]" />
                <span>
                  Gerando ZIP ({exportProgress?.current ?? 0}/{exportProgress?.total ?? data?.total})…
                </span>
              </>
            ) : (
              <>
                <Archive size={14} className="text-[#0C1222]" />
                <span>Exportar Todos em ZIP (.png)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {exportingZip && exportProgress && (
        <div className={`${ui.card} flex flex-col gap-2 p-4 border border-[#D4AF37]/50 bg-gradient-to-r from-[#FFFDF0] to-[#FFF9E6]`}>
          <div className="flex items-center justify-between text-xs font-bold text-[#6B4E00]">
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin text-[#B8860B]" />
              Gerando imagens de alta resolução dos {exportProgress.total} bilhetes...
            </span>
            <span>
              {Math.round((exportProgress.current / exportProgress.total) * 100)}% ({exportProgress.current}/{exportProgress.total})
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#E5D7A0]/50">
            <div
              className="h-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] transition-all duration-150"
              style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && <div className={ui.error}>{error}</div>}

      {/* Tabela de Códigos / Bilhetes */}
      {data && data.codes.length > 0 && (
        <div className={`${ui.card} max-h-[60vh] overflow-y-auto`}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-paper text-text-2 border-b border-line">
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Mentorado / Participante</th>
                <th className="p-3">Prêmio VIP Concedido</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {data.codes.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-paper/60 transition-colors">
                  <td className="p-3 font-mono font-bold text-text">{c.code}</td>
                  <td className="p-3">
                    {c.redeemedAt ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        Usado {new Date(c.redeemedAt).toLocaleDateString("pt-BR")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                        Disponível
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-medium text-text">{c.participantName ?? "—"}</td>
                  <td className="p-3 font-medium text-finora-600">{c.prizeName ?? "—"}</td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/60 bg-gradient-to-r from-[#FFF8D6] to-[#FFE89E] px-3 py-1 text-xs font-bold text-[#6B4E00] shadow-sm hover:brightness-105 active:scale-95 cursor-pointer"
                    >
                      <Crown size={12} className="text-[#B8860B]" />
                      <span>Ver Bilhete Dourado</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Interativo do Bilhete Dourado */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex max-h-[95vh] w-full max-w-[680px] flex-col items-center overflow-y-auto rounded-3xl bg-ink-950 p-6 md:p-8 border border-[#D4AF37]/50 shadow-[0_25px_70px_rgba(0,0,0,0.8)]">
            {/* Botão de Fechar */}
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="absolute top-5 right-5 flex size-10 items-center justify-center rounded-full bg-ink-900 border border-ink-line text-ink-text-2 hover:text-white hover:bg-ink-800 transition-colors cursor-pointer"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>

            <div className="mb-6 flex flex-col items-center text-center">
              <span className="font-mono text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                EXCLUSIVIDADE GRUPO Q-MAX & FINORA
              </span>
              <h2 className="font-display text-2xl font-black text-white mt-1">
                Bilhete Dourado do Mentorado
              </h2>
              <p className="text-xs text-ink-text-2 mt-1">
                Pronto para impressão em alta qualidade ou envio digital ao convidado.
              </p>
            </div>

            {/* O Componente do Bilhete Dourado */}
            <GoldenTicket
              code={selectedTicket.code}
              eventName={eventName}
              eventSlug={eventSlug}
              participantName={selectedTicket.participantName}
              redeemedAt={selectedTicket.redeemedAt}
              showPrintButton={true}
            />
          </div>
        </div>
      )}
    </section>
  );
}
