"use client";

import {
  ArrowDown,
  ArrowUp,
  Gift,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  RefreshCw,
  Package,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Crown,
  Flame,
  SlidersHorizontal,
  Percent,
} from "lucide-react";

import {
  useMemo,
  useState,
  useCallback,
} from "react";

import { useRouter } from "next/navigation";
import { fetchAdminProxy } from "@/lib/api-client";

type Prize = {
  id: number;
  name: string;
  available_stock: number;
  probability: string | number;
  active: boolean;
  is_vip?: boolean;
};

type QueueItem = {
  id: number;
  event_id: number;
  prize_id: number;
  position: number;
  status: string;
  prizes: Prize;
};

type Props = {
  eventId: number;
  initialQueue: QueueItem[];
  prizes: Prize[];
};

export default function QueueManager({
  eventId,
  initialQueue,
  prizes,
}: Props) {
  const router = useRouter();

  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [activeTab, setActiveTab] = useState<"ALL" | "NORMAL" | "VIP">("ALL");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [normalGenerateCount, setNormalGenerateCount] = useState<number>(50);
  const [vipGenerateCount, setVipGenerateCount] = useState<number>(30);

  // Divide a fila em Normal e VIP mantendo a ordem relativa
  const normalQueue = useMemo(
    () => queue.filter((item) => !item.prizes.is_vip),
    [queue],
  );

  const vipQueue = useMemo(
    () => queue.filter((item) => item.prizes.is_vip),
    [queue],
  );

  // Prêmios disponíveis divididos por tipo
  const normalPrizes = useMemo(
    () => prizes.filter((p) => p.active && !p.is_vip),
    [prizes],
  );

  const vipPrizes = useMemo(
    () => prizes.filter((p) => p.active && p.is_vip),
    [prizes],
  );

  const nextNormalPrize = normalQueue[0]?.prizes ?? null;
  const nextVipPrize = vipQueue[0]?.prizes ?? null;

  const refreshQueue = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silencioso
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  async function addPrizeById(prizeId: number) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/prize-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          prizeId,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao adicionar prêmio na fila.");
      }

      const p = prizes.find((item) => item.id === prizeId);
      setSuccess(`"${p?.name || "Prêmio"}" adicionado à fila!`);
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao adicionar.");
    } finally {
      setSaving(false);
    }
  }

  async function generateAutoQueue(isVip: boolean, count: number, clearExisting = false) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const poolLabel = isVip ? "VIP" : "Normal";
    try {
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/generate-auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count,
          isVip,
          clearExisting,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Erro ao gerar fila ${poolLabel} automática.`);
      }

      setSuccess(`Fila ${poolLabel} gerada com ${count} itens baseados nas porcentagens do banco!`);
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Erro ao gerar fila ${poolLabel}.`);
    } finally {
      setSaving(false);
    }
  }

  async function clearPoolQueue(isVip?: boolean) {
    const poolLabel = isVip === true ? "VIP" : isVip === false ? "Normal" : "Completa";
    if (!confirm(`Tem certeza que deseja esvaziar a fila de sorteios ${poolLabel}?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const queryParam = isVip !== undefined ? `?isVip=${isVip}` : "";
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/clear${queryParam}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao limpar fila.");
      }

      setSuccess(`Fila ${poolLabel} esvaziada com sucesso!`);
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao limpar fila.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: number) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/prize-queue/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao remover prêmio da fila.");
      }

      setSuccess("Item removido com sucesso!");
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover item.");
    } finally {
      setSaving(false);
    }
  }

  // Reordenação por Pool (Normal ou VIP)
  async function handlePoolMove(isVip: boolean, index: number, direction: "up" | "down" | "top") {
    const poolItems = isVip ? [...vipQueue] : [...normalQueue];
    if (index < 0 || index >= poolItems.length) return;

    let updatedPool: QueueItem[] = [];

    if (direction === "top") {
      if (index === 0) return;
      const target = poolItems[index];
      const rest = poolItems.filter((_, i) => i !== index);
      updatedPool = [target, ...rest];
    } else {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= poolItems.length) return;
      updatedPool = [...poolItems];
      const temp = updatedPool[index];
      updatedPool[index] = updatedPool[targetIndex];
      updatedPool[targetIndex] = temp;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const queueIds = updatedPool.map((item) => item.id);
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueIds,
          isVip,
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao salvar nova ordem da fila.");
      }

      setSuccess(`Ordem da fila ${isVip ? "VIP" : "Normal"} atualizada!`);
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reordenar.");
      await refreshQueue();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#E3F6EA] border-2 border-[#B7E4C7] text-[#0F7A3D] text-sm font-bold shadow-sm animate-in fade-in">
          <CheckCircle2 size={20} className="text-[#0F7A3D] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#FDE8EC] border-2 border-[#F5C2CD] text-[#A3112F] text-sm font-bold shadow-sm animate-in fade-in">
          <AlertCircle size={20} className="text-[#A3112F] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Barra de Filtro / Abas das Duas Filas */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-2 rounded-2xl bg-surface border-2 border-line">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("ALL")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
              activeTab === "ALL"
                ? "bg-text text-paper shadow-md"
                : "text-text hover:bg-line"
            }`}
          >
            <SlidersHorizontal size={16} />
            <span>Visão Lado a Lado (Ambas as Filas)</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-paper/20">
              {queue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("NORMAL")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
              activeTab === "NORMAL"
                ? "bg-finora-600 text-white shadow-md"
                : "text-text hover:bg-line"
            }`}
          >
            <Gift size={16} />
            <span>Fila Roleta Normal</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-white/20">
              {normalQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("VIP")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition ${
              activeTab === "VIP"
                ? "bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-md"
                : "text-text hover:bg-line"
            }`}
          >
            <Crown size={16} className="text-yellow-300" />
            <span>Fila Roleta VIP (CEO Hugo)</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-black/20">
              {vipQueue.length}
            </span>
          </button>
        </div>

        <button
          onClick={refreshQueue}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-paper border border-line-strong hover:bg-line text-text font-bold text-xs transition"
          title="Sincronizar Filas em Tempo Real"
        >
          <RefreshCw size={15} className={refreshing ? "animate-spin text-finora-600" : ""} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Renderização das Duas Filas (Lado a Lado ou Isolada) */}
      <div
        className={`grid gap-6 ${
          activeTab === "ALL" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* ========================================================= */}
        {/* COLUNA 1: FILA DA ROLETA NORMAL (BRINDES GERAIS)           */}
        {/* ========================================================= */}
        {(activeTab === "ALL" || activeTab === "NORMAL") && (
          <div className="space-y-6">
            {/* Card Destaque: Próximo Brinde Normal */}
            <div className="relative overflow-hidden rounded-3xl bg-surface border-2 border-line-strong p-6 sm:p-7 flex flex-col justify-between shadow-sm">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-finora-500/5 blur-2xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black uppercase tracking-wider">
                    <Gift size={14} className="text-emerald-600" />
                    <span>ROLETA NORMAL · 1º GIRO</span>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-paper border border-line-strong text-text">
                    {normalQueue.length} giros agendados
                  </span>
                </div>

                {nextNormalPrize ? (
                  <div className="my-2">
                    <span className="text-xs font-bold text-text-2 uppercase tracking-wider">
                      Próximo prêmio a sair no estande:
                    </span>
                    <h3 className="text-2xl sm:text-4xl font-black text-text tracking-tight leading-tight mt-1 mb-2">
                      {nextNormalPrize.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                        Estoque: {nextNormalPrize.available_stock} un.
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold">
                        <Percent size={12} /> {Number(nextNormalPrize.probability || 0)}% no banco
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold">
                        Posição #1 na Fila
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="my-2 py-2">
                    <h3 className="text-2xl font-black text-text">Fila Normal Vazia</h3>
                    <p className="text-xs text-text-2 mt-1">
                      A roleta normal sorteará dinamicamente ou gere uma fila volumosa abaixo.
                    </p>
                  </div>
                )}
              </div>

              {/* Controles de Ação Fila Normal */}
              <div className="mt-6 pt-5 border-t border-line flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={normalGenerateCount}
                    onChange={(e) => setNormalGenerateCount(Number(e.target.value))}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl bg-paper border border-line-strong text-xs font-black text-text focus:outline-none"
                  >
                    <option value={30}>30 Giros</option>
                    <option value={50}>50 Giros</option>
                    <option value={100}>100 Giros</option>
                  </select>

                  <button
                    onClick={() => generateAutoQueue(false, normalGenerateCount, false)}
                    disabled={saving || normalPrizes.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-finora-600 hover:bg-finora-700 text-white font-black text-xs transition active:scale-95 disabled:opacity-50"
                  >
                    <Wand2 size={15} />
                    <span>Gerar Fila Normal Alta (% Real)</span>
                  </button>
                </div>

                {normalQueue.length > 0 && (
                  <button
                    onClick={() => clearPoolQueue(false)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FDE8EC] hover:bg-[#FAD4DC] border border-[#F5C2CD] text-[#A3112F] font-bold text-xs transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>Limpar Normal</span>
                  </button>
                )}
              </div>
            </div>

            {/* Adicionar Prêmio Rápido à Fila Normal */}
            <div className="rounded-3xl bg-surface border-2 border-line p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-black text-text flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />
                  <span>Adicionar Brinde à Fila Normal</span>
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-paper border border-line-strong text-text-2">
                  {normalPrizes.length} brindes cadastrados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {normalPrizes.length === 0 ? (
                  <p className="text-xs text-text-2 italic col-span-2 py-3 text-center">
                    Nenhum brinde normal cadastrado.
                  </p>
                ) : (
                  normalPrizes.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPrizeById(p.id)}
                      disabled={saving || p.available_stock <= 0}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-paper hover:bg-emerald-50 border border-line hover:border-emerald-200 text-left transition group disabled:opacity-40"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-text group-hover:text-emerald-800 text-xs truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-text-2 font-semibold">
                          {Number(p.probability)}% · {p.available_stock} un.
                        </p>
                      </div>
                      <span className="p-1 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                        <Plus size={13} />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Lista Ordenada da Fila Normal */}
            <div className="rounded-3xl bg-surface border-2 border-line p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                <div>
                  <h4 className="text-base font-black text-text flex items-center gap-2">
                    <Layers size={18} className="text-finora-600" />
                    <span>Sequência da Roleta Normal</span>
                  </h4>
                  <p className="text-[11px] text-text-2 font-medium mt-0.5">
                    Ordem cronológica exata em que cada participante receberá seu brinde no estande.
                  </p>
                </div>
              </div>

              {normalQueue.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-line rounded-2xl bg-paper">
                  <Gift size={36} className="mx-auto text-text-2 mb-2 opacity-50" />
                  <p className="text-xs font-bold text-text">Fila de brindes normais vazia</p>
                  <p className="text-[11px] text-text-2 mt-1">
                    Clique em "Gerar Fila Normal Alta" acima para popular 50 giros proporcionais.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {normalQueue.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                        index === 0
                          ? "bg-emerald-50/60 border-2 border-emerald-300"
                          : "bg-paper border-line hover:border-line-strong"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            index === 0
                              ? "bg-emerald-600 text-white"
                              : "bg-line text-text"
                          }`}
                        >
                          #{index + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="font-black text-text text-xs sm:text-sm truncate">
                              {item.prizes.name}
                            </h5>
                            {index === 0 && (
                              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded uppercase">
                                Próximo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-2 font-medium">
                            Estoque: <span className="font-bold text-emerald-700">{item.prizes.available_stock} un.</span> · Chance: <span className="font-bold">{Number(item.prizes.probability)}%</span>
                          </p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {index > 0 && (
                          <button
                            onClick={() => handlePoolMove(false, index, "top")}
                            disabled={saving}
                            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] transition active:scale-95"
                            title="Colocar como #1 (Próximo Giro)"
                          >
                            <Flame size={12} />
                            <span>#1</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePoolMove(false, index, "up")}
                          disabled={index === 0 || saving}
                          className="p-1.5 rounded-lg bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                          title="Subir posição"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => handlePoolMove(false, index, "down")}
                          disabled={index === normalQueue.length - 1 || saving}
                          className="p-1.5 rounded-lg bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                          title="Descer posição"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition ml-0.5"
                          title="Remover da fila"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* COLUNA 2: FILA DA ROLETA VIP (CEO HUGO / REUNIÃO)          */}
        {/* ========================================================= */}
        {(activeTab === "ALL" || activeTab === "VIP") && (
          <div className="space-y-6">
            {/* Card Destaque: Próximo Prêmio VIP */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1405] via-[#241A08] to-[#120D04] border-2 border-[#D4AF37] p-6 sm:p-7 flex flex-col justify-between text-white shadow-xl">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-52 h-52 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#FFE57F] text-xs font-black uppercase tracking-wider">
                    <Crown size={14} className="text-[#FFD700]" />
                    <span>ROLETA VIP · REUNIÃO COM CEO</span>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-white/10 border border-[#D4AF37]/40 text-[#FFE57F]">
                    {vipQueue.length} giros agendados
                  </span>
                </div>

                {nextVipPrize ? (
                  <div className="my-2">
                    <span className="text-xs font-bold text-amber-200/80 uppercase tracking-wider">
                      Próximo prêmio nobre da Roleta VIP:
                    </span>
                    <h3 className="text-2xl sm:text-4xl font-black text-[#FFF4A3] tracking-tight leading-tight mt-1 mb-2 drop-shadow-sm">
                      {nextVipPrize.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-200 font-bold">
                        Estoque: {nextVipPrize.available_stock} un.
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-yellow-400/20 border border-yellow-400/40 text-yellow-200 font-bold">
                        <Percent size={12} /> {Number(nextVipPrize.probability || 0)}% no banco
                      </span>
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/10 border border-white/20 text-white font-bold">
                        Posição #1 na Fila VIP
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="my-2 py-2">
                    <h3 className="text-2xl font-black text-amber-100">Fila VIP Vazia</h3>
                    <p className="text-xs text-amber-200/70 mt-1">
                      A roleta VIP sorteará dinamicamente por peso ou gere uma fila volumosa abaixo.
                    </p>
                  </div>
                )}
              </div>

              {/* Controles de Ação Fila VIP */}
              <div className="mt-6 pt-5 border-t border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <select
                    value={vipGenerateCount}
                    onChange={(e) => setVipGenerateCount(Number(e.target.value))}
                    disabled={saving}
                    className="px-3 py-2 rounded-xl bg-black/40 border border-amber-500/40 text-xs font-black text-amber-200 focus:outline-none"
                  >
                    <option value={20}>20 Giros</option>
                    <option value={30}>30 Giros</option>
                    <option value={50}>50 Giros</option>
                  </select>

                  <button
                    onClick={() => generateAutoQueue(true, vipGenerateCount, false)}
                    disabled={saving || vipPrizes.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs transition active:scale-95 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Sparkles size={15} />
                    <span>Gerar Fila VIP Alta (% Real)</span>
                  </button>
                </div>

                {vipQueue.length > 0 && (
                  <button
                    onClick={() => clearPoolQueue(true)}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-200 font-bold text-xs transition active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    <span>Limpar VIP</span>
                  </button>
                )}
              </div>
            </div>

            {/* Adicionar Prêmio Rápido à Fila VIP */}
            <div className="rounded-3xl bg-surface border-2 border-line p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-black text-text flex items-center gap-2">
                  <Crown size={16} className="text-amber-600" />
                  <span>Adicionar Prêmio à Fila VIP</span>
                </h4>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-paper border border-line-strong text-text-2">
                  {vipPrizes.length} prêmios nobres
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {vipPrizes.length === 0 ? (
                  <p className="text-xs text-text-2 italic col-span-2 py-3 text-center">
                    Nenhum prêmio VIP cadastrado.
                  </p>
                ) : (
                  vipPrizes.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPrizeById(p.id)}
                      disabled={saving || p.available_stock <= 0}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-paper hover:bg-amber-50 border border-line hover:border-amber-300 text-left transition group disabled:opacity-40"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-bold text-text group-hover:text-amber-900 text-xs truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-text-2 font-semibold">
                          {Number(p.probability)}% · {p.available_stock} un.
                        </p>
                      </div>
                      <span className="p-1 rounded-lg bg-amber-100 text-amber-900 shrink-0">
                        <Plus size={13} />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Lista Ordenada da Fila VIP */}
            <div className="rounded-3xl bg-surface border-2 border-line p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-line">
                <div>
                  <h4 className="text-base font-black text-text flex items-center gap-2">
                    <Crown size={18} className="text-amber-600" />
                    <span>Sequência da Roleta VIP</span>
                  </h4>
                  <p className="text-[11px] text-text-2 font-medium mt-0.5">
                    Ordem cronológica exata em que cada participante com reunião agendada receberá seu prêmio VIP.
                  </p>
                </div>
              </div>

              {vipQueue.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-line rounded-2xl bg-paper">
                  <Crown size={36} className="mx-auto text-amber-600/50 mb-2" />
                  <p className="text-xs font-bold text-text">Fila de prêmios VIP vazia</p>
                  <p className="text-[11px] text-text-2 mt-1">
                    Clique em "Gerar Fila VIP Alta" acima para popular 30 giros proporcionais.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {vipQueue.map((item, index) => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition ${
                        index === 0
                          ? "bg-amber-50/70 border-2 border-amber-400"
                          : "bg-paper border-line hover:border-line-strong"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                            index === 0
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-sm"
                              : "bg-line text-text"
                          }`}
                        >
                          #{index + 1}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="font-black text-text text-xs sm:text-sm truncate">
                              {item.prizes.name}
                            </h5>
                            {index === 0 && (
                              <span className="text-[10px] font-black text-amber-900 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded uppercase">
                                Próximo VIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-text-2 font-medium">
                            Estoque: <span className="font-bold text-amber-800">{item.prizes.available_stock} un.</span> · Chance: <span className="font-bold">{Number(item.prizes.probability)}%</span>
                          </p>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {index > 0 && (
                          <button
                            onClick={() => handlePoolMove(true, index, "top")}
                            disabled={saving}
                            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold text-[11px] transition active:scale-95"
                            title="Colocar como #1 (Próximo Giro VIP)"
                          >
                            <Crown size={12} />
                            <span>#1</span>
                          </button>
                        )}
                        <button
                          onClick={() => handlePoolMove(true, index, "up")}
                          disabled={index === 0 || saving}
                          className="p-1.5 rounded-lg bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                          title="Subir posição"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => handlePoolMove(true, index, "down")}
                          disabled={index === vipQueue.length - 1 || saving}
                          className="p-1.5 rounded-lg bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                          title="Descer posição"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={saving}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition ml-0.5"
                          title="Remover da fila VIP"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
