"use client";

import {
  Boxes,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  X,
} from "lucide-react";
import { ui } from "@/components/form/Paper";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type Prize = {
  id: number;
  name: string;
  available_stock: number;
  active: boolean;
};

type Props = {
  eventId: number;
};

type Operation = "ADD" | "REMOVE";

export default function StockControl({
  eventId,
}: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();


  const [open, setOpen] =
    useState(false);

  const [prizes, setPrizes] =
    useState<Prize[]>([]);

  const [selectedPrizeId, setSelectedPrizeId] =
    useState<number | null>(null);

  const [operation, setOperation] =
    useState<Operation>("ADD");

  const [quantity, setQuantity] =
    useState("1");

  const [reason, setReason] =
    useState("");

  const [loadingPrizes, setLoadingPrizes] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [success, setSuccess] =
    useState<string | null>(null);

  const selectedPrize =
    useMemo(
      () =>
        prizes.find(
          (item) =>
            item.id === selectedPrizeId,
        ) ?? null,
      [prizes, selectedPrizeId],
    );

  const parsedQuantity =
    Number(quantity);

  const projectedStock =
    selectedPrize
      ? operation === "ADD"
        ? selectedPrize.available_stock +
          (Number.isFinite(parsedQuantity)
            ? parsedQuantity
            : 0)
        : selectedPrize.available_stock -
          (Number.isFinite(parsedQuantity)
            ? parsedQuantity
            : 0)
      : 0;

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

      const data =
        await response.json();

      const valid =
        data.filter(
          (item: Prize) =>
            item.active,
        );

      setPrizes(valid);

      if (
        valid.length > 0 &&
        !selectedPrizeId
      ) {
        setSelectedPrizeId(
          valid[0].id,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar prêmios.",
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
    setError(null);
    setSuccess(null);

    if (!selectedPrizeId) {
      setError(
        "Selecione um prêmio.",
      );

      return;
    }

    if (
      !Number.isInteger(
        parsedQuantity,
      ) ||
      parsedQuantity <= 0
    ) {
      setError(
        "Informe uma quantidade inteira maior que zero.",
      );

      return;
    }

    if (
      operation === "REMOVE" &&
      selectedPrize &&
      parsedQuantity >
        selectedPrize.available_stock
    ) {
      setError(
        "Não é possível remover mais unidades do que o estoque disponível.",
      );

      return;
    }

    if (
      operation === "REMOVE" &&
      !reason.trim()
    ) {
      setError(
        "Informe o motivo da saída de estoque.",
      );

      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/prizes/${selectedPrizeId}/stock`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            operation,
            quantity:
              parsedQuantity,
            reason:
              reason.trim() ||
              (operation === "ADD"
                ? "Entrada de estoque pelo painel administrativo"
                : undefined),
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(
            result?.message,
          )
            ? result.message.join(" ")
            : result?.message ||
                "Não foi possível atualizar o estoque.",
        );
      }

      setSuccess(
        operation === "ADD"
          ? "Estoque adicionado com sucesso."
          : "Estoque removido com sucesso.",
      );

      setReason("");
      setQuantity("1");

      await loadPrizes();

      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setSuccess(null);
      }, 900);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao atualizar estoque.",
      );
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
          setOpen(true);
          setError(null);
          setSuccess(null);
        }}
      >
        <Boxes size={14} />
        Adicionar estoque
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
          <div className={ui.modalMd}>
            <div className={ui.modalHeader}>
              <div>
                <span className={ui.eyebrow}>
                  ESTOQUE
                </span>

                <h2>
                  Movimentar estoque
                </h2>

                <p>
                  Registre entradas e saídas de prêmios do stand com histórico e auditoria.
                </p>
              </div>

              <button
                type="button"
                className={ui.modalClose}
                onClick={() =>
                  setOpen(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <div className={ui.field}>
              <label>
                Prêmio
              </label>

              {loadingPrizes ? (
                <div className="flex min-h-[100px] items-center justify-center gap-2 text-sm text-text-2">
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />
                  Carregando...
                </div>
              ) : (
                <select
                  className={ui.input}
                  value={
                    selectedPrizeId ??
                    ""
                  }
                  onChange={(event) =>
                    setSelectedPrizeId(
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                >
                  {prizes.map(
                    (prize) => (
                      <option
                        key={prize.id}
                        value={prize.id}
                      >
                        {prize.name}
                      </option>
                    ),
                  )}
                </select>
              )}
            </div>

            {selectedPrize && (
              <div className="mt-3 rounded-xl border border-line bg-paper p-3.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2 [&_small]:block [&_small]:text-xs [&_small]:text-text-2 [&_strong]:my-1 [&_strong]:block [&_strong]:font-display [&_strong]:text-[26px] [&_strong]:font-bold">
                <span>
                  Estoque atual
                </span>

                <strong>
                  {
                    selectedPrize.available_stock
                  }
                </strong>

                <small>
                  unidades disponíveis
                </small>
              </div>
            )}

            <div className={ui.field}>
              <label>
                Tipo de movimentação
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={
                    operation ===
                    "ADD"
                      ? "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold border-finora-600 bg-[#E6F0FF] text-finora-600"
                      : "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold border-line bg-surface text-text-2"
                  }
                  onClick={() =>
                    setOperation("ADD")
                  }
                >
                  <Plus size={16} />
                  Entrada
                </button>

                <button
                  type="button"
                  className={
                    operation ===
                    "REMOVE"
                      ? "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold border-[#F5C2CD] bg-[#FDE8EC] text-[#A3112F]"
                      : "flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-semibold border-line bg-surface text-text-2"
                  }
                  onClick={() =>
                    setOperation(
                      "REMOVE",
                    )
                  }
                >
                  <Minus size={16} />
                  Saída
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
              <div className={ui.field}>
                <label>
                  Quantidade
                </label>

                <input
                  className={ui.input}
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target
                        .value,
                    )
                  }
                />
              </div>

              <div className={ui.field}>
                <label>
                  Novo estoque
                </label>

                <div
                  className={
                    projectedStock < 0
                      ? "flex h-11 items-center rounded-field border border-[#F5C2CD] bg-[#FDE8EC] px-3 font-mono text-base font-bold text-[#A3112F]"
                      : "flex h-11 items-center rounded-field border border-line bg-paper px-3 font-mono text-base font-bold text-text"
                  }
                >
                  {selectedPrize
                    ? projectedStock
                    : "-"}
                </div>
              </div>
            </div>

            <div className={ui.field}>
              <label>
                {operation === "REMOVE"
                  ? "Motivo da saída"
                  : "Observação (opcional)"}
              </label>

              <textarea
                rows={3}
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Ex.: reposição de brindes no stand, item danificado..."
              />
            </div>

            {error && (
              <div className={ui.error}>
                {error}
              </div>
            )}

            {success && (
              <div className={ui.success}>
                <Check size={15} />
                {success}
              </div>
            )}

            <div className={ui.modalFooter}>
              <button
                type="button"
                className={ui.pill}
                disabled={saving}
                onClick={() =>
                  setOpen(false)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className={ui.primary}
                disabled={saving}
                onClick={
                  handleSave
                }
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                    Salvando...
                  </>
                ) : (
                  <>
                    {operation ===
                    "ADD" ? (
                      <Plus
                        size={15}
                      />
                    ) : (
                      <Minus
                        size={15}
                      />
                    )}

                    Confirmar movimentação
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
