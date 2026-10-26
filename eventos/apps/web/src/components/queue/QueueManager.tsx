"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Gift,
  LoaderCircle,
  Plus,
  Trash2,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  Package,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Crown,
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
  const [openAdd, setOpenAdd] = useState(false);
  const [selectedPrizeId, setSelectedPrizeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availablePrizes = useMemo(() => {
    return prizes.filter((prize) => prize.active && prize.available_stock > 0);
  }, [prizes]);

  const nextPrize = useMemo(() => {
    return queue[0]?.prizes ?? null;
  }, [queue]);

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

  async function generateAutoQueue() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/generate-auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 12 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao gerar fila automática.");
      }

      setSuccess("Fila de 12 sorteios gerada com sucesso!");
      await refreshQueue();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar fila automática.");
    } finally {
      setSaving(false);
    }
  }

  async function clearAllQueue() {
    if (!confirm("Tem certeza que deseja esvaziar a fila de sorteios?")) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/clear`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao limpar fila.");
      }

      setSuccess("Fila de prêmios esvaziada!");
      setQueue([]);
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

  async function moveToTop(index: number) {
    if (index <= 0 || index >= queue.length) return;

    const targetItem = queue[index];
    const remaining = queue.filter((_, i) => i !== index);
    const updatedQueue = [targetItem, ...remaining].map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));

    setQueue(updatedQueue);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const queueIds = updatedQueue.map((item) => item.id);
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueIds }),
      });

      if (!res.ok) {
        throw new Error("Erro ao reordenar a fila.");
      }

      setSuccess(`"${targetItem.prizes.name}" definido como Próximo Giro!`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reordenar.");
      await refreshQueue();
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;

    const newQueue = [...queue];
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;

    const updatedQueue = newQueue.map((item, idx) => ({
      ...item,
      position: idx + 1,
    }));

    setQueue(updatedQueue);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const queueIds = updatedQueue.map((item) => item.id);
      const res = await fetchAdminProxy(`/prize-queue/event/${eventId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueIds }),
      });

      if (!res.ok) {
        throw new Error("Erro ao reordenar a fila.");
      }

      setSuccess("Ordem da fila atualizada!");
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
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#E3F6EA] border-2 border-[#B7E4C7] text-[#0F7A3D] text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={20} className="text-[#0F7A3D] shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-[#FDE8EC] border-2 border-[#F5C2CD] text-[#A3112F] text-sm font-bold animate-in fade-in">
          <AlertCircle size={20} className="text-[#A3112F] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Banner Destaque Próximo Prêmio & Ações Rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-surface border-2 border-line-strong p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF3DC] border border-[#F2D19B] text-[#8A4B00] text-xs font-black uppercase tracking-wider">
                <Sparkles size={14} className="text-[#8A4B00] animate-pulse" />
                <span>PRÓXIMO PRÊMIO NA ROLETA</span>
              </div>
              <button
                onClick={refreshQueue}
                disabled={refreshing}
                className="p-2.5 rounded-xl bg-[#EEF1F5] border border-line-strong text-text hover:text-text hover:bg-line-strong transition"
                title="Atualizar Fila"
              >
                <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>

            {nextPrize ? (
              <div className="my-3">
                <h3 className="text-3xl sm:text-5xl font-black text-text tracking-tight leading-none mb-3">
                  {nextPrize.name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E3F6EA] border border-[#B7E4C7] text-[#0F7A3D] font-bold text-xs">
                    Estoque: {nextPrize.available_stock} unidades disponíveis
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E6F0FF] border border-[#B9D4F7] text-finora-600 font-bold text-xs">
                    ⭐ Posição #1 na Fila de Giros
                  </span>
                </div>
              </div>
            ) : (
              <div className="my-3">
                <h3 className="text-2xl sm:text-3xl font-black text-text">
                  Fila de prêmios vazia
                </h3>
                <p className="text-sm text-text mt-2 font-medium">
                  A roleta usará o sorteio automático por peso ou você pode clicar no botão abaixo para gerar uma fila pronta com 12 prêmios!
                </p>
              </div>
            )}
          </div>

          {/* Botões de Ação na Fila */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-line">
            <button
              onClick={generateAutoQueue}
              disabled={saving || availablePrizes.length === 0}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-finora-600 hover:bg-finora-700 text-white font-black text-sm transition active:scale-95 disabled:opacity-50"
            >
              <Wand2 size={18} />
              <span>Gerar Fila Automática (12 Giros)</span>
            </button>

            {queue.length > 0 && (
              <button
                onClick={clearAllQueue}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#FDE8EC] hover:bg-[#FAD4DC] border border-[#F5C2CD] text-[#A3112F] font-bold text-sm transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={16} />
                <span>Esvaziar Fila</span>
              </button>
            )}
          </div>
        </div>

        {/* Card Catálogo de Adição Rápida */}
        <div className="rounded-3xl bg-surface border-2 border-line p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-lg font-black text-text flex items-center gap-2">
                <Package size={20} className="text-[#0F7A3D]" />
                <span>Adicionar à Fila</span>
              </h4>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EEF1F5] text-text border border-line-strong">
                {availablePrizes.length} ativos
              </span>
            </div>
            <p className="text-xs text-text font-medium mb-4">
              Clique em qualquer brinde abaixo para colocar no fim da fila instantaneamente:
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {availablePrizes.length === 0 ? (
                <p className="text-xs text-text-2 italic py-4 text-center">Nenhum prêmio ativo com estoque disponível.</p>
              ) : (
                availablePrizes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addPrizeById(p.id)}
                    disabled={saving}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-[#EEF1F5] hover:bg-[#D2EFDC] border border-line-strong hover:border-[#B7E4C7] text-left transition group"
                  >
                    <span className="font-bold text-text group-hover:text-[#0F7A3D] text-sm truncate">
                      {p.name}
                    </span>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[#E3F6EA] text-[#0F7A3D] border border-[#B7E4C7] shrink-0 ml-2 flex items-center gap-1">
                      <Plus size={12} /> {p.available_stock} un.
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela / Lista da Fila Numerada */}
      <div className="rounded-3xl bg-surface border-2 border-line p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-line">
          <div>
            <h3 className="text-xl font-black text-text flex items-center gap-2">
              <Layers size={22} className="text-finora-600" />
              <span>Ordem da Fila de Sorteios</span>
            </h3>
            <p className="text-xs text-text font-medium mt-1">
              {queue.length === 1 ? "1 prêmio agendado" : `${queue.length} prêmios agendados em sequência`}
            </p>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-14 border-2 border-dashed border-line rounded-3xl bg-paper">
            <Gift size={44} className="mx-auto text-text-2 mb-3" />
            <h4 className="text-lg font-bold text-text">Nenhum prêmio na fila</h4>
            <p className="text-sm text-text-2 mt-1 max-w-md mx-auto">
              Sua fila está vazia. Clique em <strong>"Gerar Fila Automática"</strong> acima ou selecione prêmios no painel lateral de adição rápida.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition ${
                  index === 0
                    ? "bg-[#EEF1F5] border-2 border-[#F2D19B]"
                    : "bg-paper border-line-strong hover:bg-[#EEF1F5] hover:border-line-strong"
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      index === 0
                        ? "bg-warning text-white"
                        : "bg-line text-text border border-line-strong"
                    }`}
                  >
                    #{item.position || index + 1}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h5 className="font-black text-text text-base sm:text-lg truncate">
                        {item.prizes.name}
                      </h5>
                      {index === 0 && (
                        <span className="text-[11px] font-black text-[#8A4B00] bg-[#FFF3DC] border border-[#F2D19B] px-2 py-0.5 rounded-md uppercase tracking-wider">
                          Próximo Giro
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text font-semibold mt-0.5">
                      Estoque restante: <span className="text-[#0F7A3D] font-bold">{item.prizes.available_stock} un.</span>
                    </p>
                  </div>
                </div>

                {/* Controles de Subir, Descer, Tornar Próximo e Excluir */}
                <div className="flex items-center gap-2 shrink-0">
                  {index > 0 && (
                    <button
                      onClick={() => moveToTop(index)}
                      disabled={saving}
                      className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-full bg-[#FFF3DC] hover:bg-[#FDE7BE] text-[#8A4B00] border border-[#F2D19B] text-xs font-black transition active:scale-95"
                      title="Mover diretamente para a posição #1 (Próximo Giro)"
                    >
                      <Crown size={13} className="text-[#8A4B00]" />
                      <span>Tornar Próximo</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0 || saving}
                    className="p-2.5 rounded-xl bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                    title="Subir posição na fila"
                  >
                    <ArrowUp size={16} />
                  </button>

                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === queue.length - 1 || saving}
                    className="p-2.5 rounded-xl bg-line hover:bg-line-strong text-text disabled:opacity-20 transition"
                    title="Descer posição na fila"
                  >
                    <ArrowDown size={16} />
                  </button>

                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={saving}
                    className="p-2.5 rounded-xl bg-[#FDE8EC] hover:bg-[#FAD4DC] text-[#A3112F] border border-[#F5C2CD] transition ml-1"
                    title="Remover este prêmio da fila"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
