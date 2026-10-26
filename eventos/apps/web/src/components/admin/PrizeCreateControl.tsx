"use client";

import {
  Check,
  Gift,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { ui } from "@/components/form/Paper";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type Props = {
  eventId: number;
};

export default function PrizeCreateControl({
  eventId,
}: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();


  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] =
    useState("");
  const [initialStock, setInitialStock] =
    useState("0");
  const [probability, setProbability] =
    useState("0");
  const [active, setActive] = useState(true);
  const [isVip, setIsVip] = useState(false);

  const [saving, setSaving] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState(false);

  async function handleSave() {
    setError(null);

    const stock =
      Number(initialStock);

    const chance =
      Number(probability);

    if (!name.trim()) {
      setError("Informe o nome do prêmio.");
      return;
    }

    if (
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      setError(
        "O estoque inicial deve ser um número inteiro válido.",
      );
      return;
    }

    if (
      !Number.isFinite(chance) ||
      chance < 0 ||
      chance > 100
    ) {
      setError(
        "A probabilidade deve estar entre 0 e 100.",
      );
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${API_URL}/prizes`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            eventId,
            name: name.trim(),
            description:
              description.trim() ||
              undefined,
            initialStock: stock,
            probability: chance,
            active,
            isVip,
          }),
        },
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message ||
                "Não foi possível criar o prêmio.",
        );
      }

      setSuccess(true);

      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setName("");
        setDescription("");
        setInitialStock("0");
        setProbability("0");
        setActive(true);
        setIsVip(false);
      }, 800);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao criar prêmio.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={ui.primary}
        onClick={() => {
          setOpen(true);
          setError(null);
          setSuccess(false);
        }}
      >
        <Plus size={14} />
        Novo prêmio
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
                  PREMIAÇÃO
                </span>

                <h2>Novo prêmio</h2>

                <p>
                  Cadastre uma nova recompensa para o evento Clinicorp.
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
                Nome do prêmio *
              </label>

              <input
                className={ui.input}
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                placeholder="Ex.: Garrafa Térmica Finora, Mochila, etc."
              />
            </div>

            <div className={ui.field}>
              <label>
                Descrição
              </label>

              <textarea
                rows={3}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Descrição detalhada do prêmio ou regras de entrega..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              <div className={ui.field}>
                <label>
                  Estoque inicial
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  className={ui.input}
                  value={initialStock}
                  onChange={(event) =>
                    setInitialStock(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className={ui.field}>
                <label>
                  Probabilidade na Roleta (%)
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={ui.input}
                  value={probability}
                  onChange={(event) =>
                    setProbability(
                      event.target.value,
                    )
                  }
                />
                <span className="text-[10px] text-text-2 block mt-1">
                  * Use 0% para Super Prêmios sorteados exclusivamente no Mega Sorteio Geral.
                </span>
              </div>
            </div>

            <label className="mt-4 flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-paper p-3 text-left [&_input]:mt-0.5 [&_input]:accent-finora-600 [&_strong]:block [&_strong]:text-sm [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) =>
                  setActive(
                    event.target.checked,
                  )
                }
              />

              <div>
                <strong>
                  Prêmio ativo
                </strong>

                <span>
                  Poderá participar dos sorteios enquanto possuir estoque.
                </span>
              </div>
            </label>

            <label className="mt-2 flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-paper p-3 text-left [&_input]:mt-0.5 [&_input]:accent-finora-600 [&_strong]:block [&_strong]:text-sm [&_span]:mt-0.5 [&_span]:block [&_span]:text-xs [&_span]:text-text-2">
              <input type="checkbox" checked={isVip} onChange={(event) => setIsVip(event.target.checked)} />
              <div>
                <strong>Prêmio VIP</strong>
                <span>Só sai na roleta de quem cadastrou um código de cartão VIP.</span>
              </div>
            </label>

            {error && (
              <div className={ui.error}>
                {error}
              </div>
            )}

            {success && (
              <div className={ui.success}>
                <Check size={15} />
                Prêmio criado com sucesso.
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
                onClick={handleSave}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      size={15}
                      className="animate-spin"
                    />
                    Criando...
                  </>
                ) : (
                  <>
                    <Gift size={15} />
                    Criar prêmio
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
