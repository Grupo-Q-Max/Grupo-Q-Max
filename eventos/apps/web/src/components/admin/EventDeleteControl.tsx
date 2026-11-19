"use client";

import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

type Props = {
  eventId: number;
  eventName: string;
};

export default function EventDeleteControl({ eventId, eventName }: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/events/${eventId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message || "Não foi possível apagar o evento.",
        );
      }

      setOpen(false);
      router.refresh();
      // Optional: push to dashboard if they deleted the event they are currently on
      // router.push('/admin/dashboard'); 
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao apagar evento.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="p-3 rounded-2xl bg-surface border border-line text-text-2 hover:text-rose-400 hover:bg-rose-500/25 hover:border-rose-500/30 transition-all"
        title="Apagar Evento"
        onClick={() => setOpen(true)}
      >
        <Trash2 size={16} />
      </button>

      {open && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-surface border border-rose-500/30 rounded-3xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-line flex justify-between items-start bg-paper">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-text">Apagar Evento</h2>
                  <p className="text-xs text-text-2 mt-0.5">Ação irreversível.</p>
                </div>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-surface hover:bg-line-strong flex items-center justify-center text-text-2 hover:text-text transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-text text-sm leading-relaxed">
                Você está prestes a excluir permanentemente o evento <strong className="text-text">{eventName}</strong>.
              </p>
              
              <div className="mt-4 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-medium">
                Esta ação apagará <strong>todos</strong> os dados relacionados: participantes, prêmios, histórico, regras antifraude e configurações de WhatsApp.
              </div>

              {error && (
                <div className="mt-4 text-rose-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-end gap-3">
              <button
                type="button"
                className="px-5 py-2.5 rounded-full font-bold text-text-2 hover:text-text hover:bg-line-strong transition-colors"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="px-6 py-2.5 rounded-full font-bold text-white bg-danger hover:bg-danger transition-all flex items-center gap-2 disabled:opacity-50"
                disabled={saving}
                onClick={handleDelete}
              >
                {saving ? (
                  <><LoaderCircle size={16} className="animate-spin" /> Apagando...</>
                ) : (
                  <><Trash2 size={16} /> Sim, apagar evento</>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
