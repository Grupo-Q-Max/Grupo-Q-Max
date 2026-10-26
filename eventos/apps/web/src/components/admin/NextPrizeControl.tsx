"use client";

import {
  Check,
  ChevronDown,
  Gift,
  LoaderCircle,
  X,
} from "lucide-react";
import { ui } from "@/components/form/Paper";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type Prize = {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  initial_stock: number;
  available_stock: number;
  probability: string | number;
  active: boolean;
};

type Props = {
  eventId: number;

  currentPrize?: {
    prizeId: number;
    name: string;
    availableStock: number;
  } | null;
};

export default function NextPrizeControl({
  eventId,
  currentPrize,
}: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();


  const [open, setOpen] = useState(false);

  const [prizes, setPrizes] =
    useState<Prize[]>([]);

  const [selectedPrizeId, setSelectedPrizeId] =
    useState<number | null>(
      currentPrize?.prizeId ?? null,
    );

  const [reason, setReason] = useState(
    "Alteração manual pelo painel administrativo",
  );

  const [loading, setLoading] =
    useState(false);

  const [loadingPrizes, setLoadingPrizes] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState(false);

  async function loadPrizes() {
    setLoadingPrizes(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_URL}/prizes/event/${eventId}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Não foi possível carregar os prêmios.",
        );
      }

      const data = await response.json();

      setPrizes(
        data.filter(
          (prize: Prize) =>
            prize.active &&
            prize.available_stock > 0,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar os prêmios.",
      );
    } finally {
      setLoadingPrizes(false);
    }
  }

  useEffect(() => {
    if (open) {
      void loadPrizes();
    }
  }, [open]);

  async function handleSave() {
    if (!selectedPrizeId) {
      setError(
        "Selecione o próximo prêmio.",
      );

      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(
        `${API_URL}/prize-queue/event/${eventId}/next`,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            prizeId: selectedPrizeId,
            reason:
              reason.trim() ||
              "Alteração manual pelo painel administrativo",
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message ||
            "Não foi possível alterar o próximo prêmio.",
        );
      }

      setSuccess(true);

      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 700);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao alterar o próximo prêmio.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="h-9 rounded-full border border-white/15 bg-white/[0.04] px-4 text-xs font-bold uppercase tracking-wider text-[#00E5FF] transition-all hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
        onClick={() => {
          setError(null);
          setSuccess(false);
          setOpen(true);
        }}
      >
        Alterar próximo
      </button>

      {open && (
        <div
          className={ui.modalBackdrop}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <div className={ui.modal}>
            <div className={ui.modalHeader}>
              <div>
                <span className={ui.eyebrow}>
                  GESTÃO DE PREMIAÇÃO
                </span>

                <h2>
                  Alterar próximo prêmio
                </h2>

                <p>
                  Escolha qual recompensa será
                  entregue na próxima participação
                  elegível.
                </p>
              </div>

              <button
                type="button"
                className={ui.modalClose}
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {currentPrize && (
              <div className={ui.notice}>
                <div className={ui.noticeIcon}>
                  <Gift size={20} />
                </div>

                <div>
                  <span>
                    Próximo atualmente
                  </span>

                  <strong>
                    {currentPrize.name}
                  </strong>

                  <small>
                    {
                      currentPrize.availableStock
                    }{" "}
                    unidades disponíveis
                  </small>
                </div>
              </div>
            )}

            <div className={ui.field}>
              <label>
                Novo próximo prêmio
              </label>

              {loadingPrizes ? (
                <div className="flex min-h-[100px] items-center justify-center gap-2 text-sm text-slate-400">
                  <LoaderCircle
                    size={18}
                    className="animate-spin text-[#00E5FF]"
                  />

                  Carregando prêmios...
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {prizes.map((prize) => {
                    const selected =
                      selectedPrizeId ===
                      prize.id;

                    return (
                      <button
                        type="button"
                        key={prize.id}
                        className={
                          selected
                            ? "grid w-full grid-cols-[37px_minmax(0,1fr)_28px] items-center gap-2.5 rounded-xl border border-[#22C3DC] bg-[#22C3DC]/15 p-2.5 text-left text-white shadow-[0_0_15px_rgba(34,195,220,0.2)]"
                            : "grid w-full grid-cols-[37px_minmax(0,1fr)_28px] items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left text-white transition-colors hover:bg-white/[0.06] hover:border-white/20"
                        }
                        onClick={() =>
                          setSelectedPrizeId(
                            prize.id,
                          )
                        }
                      >
                        <div className="grid size-[34px] place-items-center rounded-lg border border-[#00E5FF]/30 bg-[#00E5FF]/15 text-[#00E5FF]">
                          <Gift size={18} />
                        </div>

                        <div className="[&_strong]:block [&_strong]:text-sm [&_strong]:text-white [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_span]:text-slate-400">
                          <strong>
                            {prize.name}
                          </strong>

                          <span>
                            Estoque:{" "}
                            {
                              prize.available_stock
                            }
                            {" • "}
                            Probabilidade:{" "}
                            {Number(
                              prize.probability,
                            )}
                            %
                          </span>
                        </div>

                        <div className="grid place-items-center text-[#00E5FF]">
                          {selected ? (
                            <Check size={16} />
                          ) : (
                            <ChevronDown
                              size={15}
                              className="text-slate-500"
                            />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={ui.field}>
              <label>
                Motivo da alteração
              </label>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Ex.: estratégia do stand, promoção especial..."
                rows={3}
              />
            </div>

            {error && (
              <div className={ui.error}>
                {error}
              </div>
            )}

            {success && (
              <div className={ui.success}>
                <Check size={16} />

                Próximo prêmio alterado com sucesso.
              </div>
            )}

            <div className={ui.modalFooter}>
              <button
                type="button"
                className={ui.pill}
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={ui.primary}
                disabled={
                  loading ||
                  !selectedPrizeId
                }
                onClick={handleSave}
              >
                {loading ? (
                  <>
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Gift size={15} />
                    Definir próximo prêmio
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
