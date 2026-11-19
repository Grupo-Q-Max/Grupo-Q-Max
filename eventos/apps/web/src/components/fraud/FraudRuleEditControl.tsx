"use client";

import {
  AlertTriangle,
  Check,
  LoaderCircle,
  Save,
  ShieldCheck,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type FraudAction =
  | "BLOCK"
  | "REVIEW"
  | "ALLOW_WITH_ALERT";

type Rule = {
  id: number;
  type: string;
  enabled: boolean;
  max_allowed: number;
  action: FraudAction;
  description: string | null;
};

type Props = {
  rule: Rule;
};

const actionLabels: Record<FraudAction, string> = {
  BLOCK: "Bloquear participação",
  REVIEW: "Enviar para análise",
  ALLOW_WITH_ALERT: "Permitir e gerar alerta",
};

const ruleLabels: Record<string, string> = {
  CPF: "CPF",
  PHONE: "Telefone",
  EMAIL: "E-mail",
  DEVICE: "Dispositivo",
  IP: "Endereço IP",
};

export default function FraudRuleEditControl({ rule }: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [enabled, setEnabled] = useState(rule.enabled);
  const [maxAllowed, setMaxAllowed] = useState(String(rule.max_allowed));
  const [action, setAction] = useState<FraudAction>(rule.action);
  const [description, setDescription] = useState(rule.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function resetForm() {
    setEnabled(rule.enabled);
    setMaxAllowed(String(rule.max_allowed));
    setAction(rule.action);
    setDescription(rule.description ?? "");
    setError(null);
    setSuccess(false);
  }

  async function handleSave() {
    setError(null);
    setSuccess(false);

    const limit = Number(maxAllowed);

    if (!Number.isInteger(limit) || limit < 1) {
      setError("O limite deve ser um número inteiro maior que zero.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/fraud-rules/${rule.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled,
          maxAllowed: limit,
          action,
          description: description.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message || "Não foi possível atualizar a regra.",
        );
      }

      setSuccess(true);
      router.refresh();

      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar regra.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-surface border border-line-strong text-text text-sm font-bold uppercase tracking-wider hover:bg-[#E6F0FF] hover:border-[#B9D4F7] hover:text-finora-600 transition-all"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        Editar
      </button>

      {open && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}
        >
          <div className="bg-surface border border-line-strong rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
            <div className="px-6 py-5 border-b border-line flex justify-between items-start bg-paper">
              <div>
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1 block">
                  SEGURANÇA ANTIFRAUDE
                </span>
                <h2 className="text-xl font-black text-text">
                  {ruleLabels[rule.type] || rule.type}
                </h2>
                <p className="text-sm text-text-2 mt-1">
                  Defina quantas participações são permitidas antes desta regra tomar uma ação.
                </p>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-line hover:bg-line-strong flex items-center justify-center text-text-2 hover:text-text transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <label className="flex items-start gap-4 p-4 rounded-2xl border border-line-strong cursor-pointer hover:bg-paper transition-colors">
                <div className="pt-1">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    className="w-5 h-5 rounded border-line-strong text-cyan-500 focus:ring-cyan-500 focus:ring-offset-surface bg-surface"
                  />
                </div>
                <div>
                  <strong className="text-text font-bold block mb-1">Regra Ativa</strong>
                  <span className="text-sm text-text-2">
                    Desative apenas se quiser ignorar completamente este controle.
                  </span>
                </div>
              </label>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Participações permitidas
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-text focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  value={maxAllowed}
                  onChange={(event) => setMaxAllowed(event.target.value)}
                />
                <small className="text-xs text-text-2 block">
                  A ação abaixo será aplicada quando este limite for ultrapassado.
                </small>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Ao ultrapassar o limite
                </label>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    className={`flex items-center text-left gap-4 p-4 rounded-xl border transition-colors ${
                      action === "BLOCK"
                        ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                        : "bg-paper border-line-strong text-text-2 hover:bg-line"
                    }`}
                    onClick={() => setAction("BLOCK")}
                  >
                    <X size={20} className={action === "BLOCK" ? "text-rose-400" : "text-text-2"} />
                    <div>
                      <strong className="block font-bold mb-0.5 text-text">Bloquear</strong>
                      <span className="text-xs">Não permite nova participação.</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`flex items-center text-left gap-4 p-4 rounded-xl border transition-colors ${
                      action === "REVIEW"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-paper border-line-strong text-text-2 hover:bg-line"
                    }`}
                    onClick={() => setAction("REVIEW")}
                  >
                    <AlertTriangle size={20} className={action === "REVIEW" ? "text-amber-400" : "text-text-2"} />
                    <div>
                      <strong className="block font-bold mb-0.5 text-text">Analisar</strong>
                      <span className="text-xs">Envia para revisão da equipe.</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`flex items-center text-left gap-4 p-4 rounded-xl border transition-colors ${
                      action === "ALLOW_WITH_ALERT"
                        ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                        : "bg-paper border-line-strong text-text-2 hover:bg-line"
                    }`}
                    onClick={() => setAction("ALLOW_WITH_ALERT")}
                  >
                    <Check size={20} className={action === "ALLOW_WITH_ALERT" ? "text-cyan-400" : "text-text-2"} />
                    <div>
                      <strong className="block font-bold mb-0.5 text-text">Permitir com Alerta</strong>
                      <span className="text-xs">Aceita, mas registra um alerta de segurança.</span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Observação Interna
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface border border-line-strong rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Explique rapidamente a finalidade desta regra..."
                />
              </div>

              <div className="bg-cyan-500/15 border border-cyan-500/30 rounded-xl p-4 flex items-center gap-3 text-cyan-300">
                <ShieldCheck size={20} className="shrink-0 text-cyan-400" />
                <div className="text-sm">
                  <strong className="font-bold text-white">Resumo: </strong>
                  Até {maxAllowed || 0} {Number(maxAllowed) === 1 ? "participação" : "participações"}. 
                  Depois: {actionLabels[action]}.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-end gap-3 shrink-0">
              {error && <span className="text-rose-400 text-sm font-bold mr-auto">{error}</span>}
              {success && <span className="text-emerald-400 text-sm font-bold flex items-center gap-1 mr-auto"><Check size={16} /> Salvo com sucesso</span>}

              <button
                type="button"
                className="px-5 py-2.5 rounded-full font-bold text-text-2 hover:text-text hover:bg-line transition-colors"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="px-6 py-2.5 rounded-full font-bold text-white bg-finora-600 hover:bg-finora-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <><LoaderCircle size={16} className="animate-spin" /> Salvando...</>
                ) : (
                  <><Save size={16} /> Salvar regra</>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
