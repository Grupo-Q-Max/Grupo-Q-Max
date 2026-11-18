"use client";

import {
  Check,
  Gift,
  LoaderCircle,
  Power,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { ui } from "@/components/form/Paper";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type Prize = {
  id: number;
  name: string;
  description: string | null;
  probability: string | number;
  active: boolean;
  is_vip?: boolean;
  available_stock: number;
};

type Props = {
  prize: Prize;
  otherActiveProbability: number;
};

function parseRules(rawDesc: string | null) {
  if (!rawDesc) return { cleanDesc: "", minInterval: 0, initialDelay: 0 };

  let clean = rawDesc;
  let minInterval = 0;
  let initialDelay = 0;

  const intervalMatch = rawDesc.match(/\[(?:INTERVALO|MIN_INTERVAL|COOLDOWN):\s*(\d+)\]/i);
  if (intervalMatch && intervalMatch[1]) {
    minInterval = parseInt(intervalMatch[1], 10);
    clean = clean.replace(intervalMatch[0], "");
  }

  const delayMatch = rawDesc.match(/\[(?:DELAY|INITIAL_DELAY|LIBERAR_APOS):\s*(\d+)\]/i);
  if (delayMatch && delayMatch[1]) {
    initialDelay = parseInt(delayMatch[1], 10);
    clean = clean.replace(delayMatch[0], "");
  }

  return { cleanDesc: clean.trim(), minInterval, initialDelay };
}

export default function PrizeEditControl({
  prize,
  otherActiveProbability,
}: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();

  const parsed = parseRules(prize.description);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(prize.name);
  const [cleanDescription, setCleanDescription] = useState(parsed.cleanDesc);
  const [minInterval, setMinInterval] = useState<number>(parsed.minInterval);
  const [initialDelay, setInitialDelay] = useState<number>(parsed.initialDelay);
  const [probability, setProbability] = useState(String(Number(prize.probability)));
  const [stock, setStock] = useState<number>(prize.available_stock);
  const [active, setActive] = useState(prize.active);
  const [isVip, setIsVip] = useState(Boolean(prize.is_vip));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const chance = Number(probability);

  const projectedTotal = useMemo(() => {
    if (!active) {
      return otherActiveProbability;
    }
    return otherActiveProbability + (Number.isFinite(chance) ? chance : 0);
  }, [active, chance, otherActiveProbability]);

  const remaining = 100 - projectedTotal;

  function resetForm() {
    const p = parseRules(prize.description);
    setName(prize.name);
    setCleanDescription(p.cleanDesc);
    setMinInterval(p.minInterval);
    setInitialDelay(p.initialDelay);
    setProbability(String(Number(prize.probability)));
    setStock(prize.available_stock);
    setActive(prize.active);
    setIsVip(Boolean(prize.is_vip));
    setError(null);
    setSuccess(false);
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError("Informe o nome do prêmio.");
      return;
    }

    if (!Number.isFinite(chance) || chance < 0 || chance > 100) {
      setError("Informe uma probabilidade válida entre 0 e 100%.");
      return;
    }

    if (!Number.isFinite(stock) || stock < 0) {
      setError("Informe uma quantidade de estoque válida maior ou igual a 0.");
      return;
    }

    if (active && projectedTotal > 100) {
      setError(`A distribuição chegaria a ${projectedTotal}%. Reduza ${projectedTotal - 100}% antes de salvar.`);
      return;
    }

    setSaving(true);

    try {
      // Monta a descrição final incluindo as tags de regras
      let finalDescription = cleanDescription.trim();
      if (minInterval > 0) {
        finalDescription += ` [INTERVALO: ${minInterval}]`;
      }
      if (initialDelay > 0) {
        finalDescription += ` [DELAY: ${initialDelay}]`;
      }

      const response = await fetch(`${API_URL}/prizes/${prize.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: finalDescription.trim() || undefined,
          probability: chance,
          availableStock: Math.floor(stock),
          active,
          isVip,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message || "Não foi possível atualizar o prêmio."
        );
      }

      setSuccess(true);
      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar prêmio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={ui.pill}
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        Editar
      </button>

      {open && (
        <div className={ui.modalBackdrop} onClick={() => !saving && setOpen(false)}>
          <div className={ui.modalLg} onClick={(e) => e.stopPropagation()}>
            <div className={ui.modalHeader}>
              <div>
                <span className={ui.eyebrow}>GESTÃO DE PRÊMIOS</span>
                <h3>Editar prêmio</h3>
              </div>
              <button
                type="button"
                className={ui.modalClose}
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                <X size={18} />
              </button>
            </div>

            <div className={ui.notice}>
              <div className={ui.noticeIcon}>
                <Gift size={20} />
              </div>
              <section>
                <strong>{prize.name}</strong>
                <span>Estoque disponível: {stock} unidades</span>
              </section>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={ui.field}>
                <label>Nome do prêmio</label>
                <input
                  className={ui.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className={ui.field}>
                <label>Quantidade em Estoque</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={ui.input}
                  value={stock}
                  onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
            </div>

            <div className={ui.field}>
              <label>Descrição pública</label>
              <textarea
                rows={2}
                value={cleanDescription}
                placeholder="Ex: Garrafa de inox personalizada Finora"
                onChange={(e) => setCleanDescription(e.target.value)}
              />
            </div>

            {/* SEÇÃO DE REGRAS INTELIGENTES DE CADÊNCIA (SMART PACING) */}
            <div className="bg-paper border border-[#B9D4F7] rounded-2xl p-4 my-2">
              <div className="flex items-center gap-2 mb-3">
                <Sliders size={16} className="text-finora-600" />
                <strong className="text-xs text-text uppercase tracking-wider">
                  Regras de Cadência & Intervalo Inteligente
                </strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-text font-semibold block mb-1">
                    Intervalo Mínimo (Cooldown de Giros)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 50"
                    className="w-full bg-surface border border-line-strong rounded-xl px-3 py-2 text-text font-mono outline-none focus:border-finora-600"
                    value={minInterval || ""}
                    onChange={(e) => setMinInterval(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <small className="text-text-2 text-[11px] mt-1 block">
                    Só sai novamente após N giros de outros prêmios.
                  </small>
                </div>

                <div>
                  <label className="text-text font-semibold block mb-1">
                    Liberar apenas após N giros no evento
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 30"
                    className="w-full bg-surface border border-line-strong rounded-xl px-3 py-2 text-text font-mono outline-none focus:border-finora-600"
                    value={initialDelay || ""}
                    onChange={(e) => setInitialDelay(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                  <small className="text-text-2 text-[11px] mt-1 block">
                    Só começa a ser sorteado a partir do N-ésimo giro do evento.
                  </small>
                </div>
              </div>
            </div>

            <div className={ui.field}>
              <label>Probabilidade do Sorteio</label>
              <div className="relative [&_input]:pr-9 [&>span]:absolute [&>span]:top-1/2 [&>span]:right-3 [&>span]:-translate-y-1/2 [&>span]:text-sm [&>span]:text-text-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={ui.input}
                  value={probability}
                  onChange={(e) => setProbability(e.target.value)}
                />
                <span>%</span>
              </div>
            </div>

            <div
              className={
                projectedTotal === 100
                  ? "mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-line bg-paper p-3 [&>div]:rounded-lg [&>div]:bg-surface [&>div]:p-2 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-base [&>footer]:col-span-full [&>footer]:bg-[#E3F6EA] [&>footer]:text-[#0F7A3D]"
                  : projectedTotal > 100
                  ? "mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-line bg-paper p-3 [&>div]:rounded-lg [&>div]:bg-surface [&>div]:p-2 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-base [&>footer]:col-span-full [&>footer]:bg-[#FDE8EC] [&>footer]:text-[#A3112F]"
                  : "mt-3.5 grid grid-cols-3 gap-2 rounded-xl border border-line bg-paper p-3 [&>div]:rounded-lg [&>div]:bg-surface [&>div]:p-2 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-base [&>footer]:col-span-full [&>footer]:bg-[#FFF3DC] [&>footer]:text-[#8A4B00]"
              }
            >
              <div>
                <span>Outros prêmios ativos</span>
                <strong>{otherActiveProbability}%</strong>
              </div>
              <div>
                <span>Este prêmio</span>
                <strong>{active ? chance || 0 : 0}%</strong>
              </div>
              <div>
                <span>Total projetado</span>
                <strong>{projectedTotal}%</strong>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-semibold ${active ? "border-[#B7E4C7] bg-[#E3F6EA] text-[#0F7A3D]" : "border-line bg-paper text-text-2"}`}
                onClick={() => setActive(!active)}
              >
                <Power size={16} />
                <span>{active ? "Prêmio ativo no sorteio" : "Prêmio inativo"}</span>
              </button>
              <label className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-paper p-3 text-sm font-semibold">
                <input type="checkbox" checked={isVip} onChange={(e) => setIsVip(e.target.checked)} />
                Prêmio VIP (só sai na roleta de quem tem cartão VIP)
              </label>
            </div>

            {error && <div className={ui.error}>{error}</div>}

            <div className={ui.modalFooter}>
              <button
                type="button"
                className={ui.pill}
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={ui.primary}
                onClick={handleSave}
                disabled={saving || (active && projectedTotal > 100)}
              >
                {saving ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    Salvando...
                  </>
                ) : success ? (
                  <>
                    <Check size={16} />
                    Salvo!
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
