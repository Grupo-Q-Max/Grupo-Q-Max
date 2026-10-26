"use client";

import { CalendarDays, Check, LoaderCircle, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";
import EventSettingsFields, { DEFAULT_EVENT_SETTINGS, settingsFromApi, settingsToApi, type EventSettings } from "./EventSettingsFields";

type EventType = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  status: string;
};

type Props = {
  event: EventType;
};

export default function EventEditControl({ event }: Props) {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(event.name);
  const [slug, setSlug] = useState(event.slug);
  const [description, setDescription] = useState(event.description || "");
  const [status, setStatus] = useState(event.status);
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Telefone de alerta e webhook não vêm na listagem pública: busca o evento completo.
  async function loadSettings() {
    setSettingsLoaded(false);
    try {
      const res = await fetch(`${API_URL}/events/${event.id}`, { cache: "no-store" });
      if (res.ok) setSettings(settingsFromApi(await res.json()));
    } finally {
      setSettingsLoaded(true);
    }
  }

  function resetForm() {
    setName(event.name);
    setSlug(event.slug);
    setDescription(event.description || "");
    setStatus(event.status);
    setError(null);
  }

  async function handleSave() {
    setError(null);

    if (!name.trim() || !slug.trim()) {
      setError("O nome e o slug são obrigatórios.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/events/${event.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          status,
          participationEnabled: status === "ACTIVE",
          ...settingsToApi(settings),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message || "Não foi possível atualizar o evento.",
        );
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="p-3 rounded-2xl bg-surface border border-line text-text-2 hover:text-finora-600 hover:bg-[#D6E7FF] hover:border-[#B9D4F7] transition-all"
        title="Editar Evento"
        onClick={() => {
          resetForm();
          loadSettings();
          setOpen(true);
        }}
      >
        <Settings size={16} />
      </button>

      {open && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-surface border border-line rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-line flex justify-between items-start bg-paper">
              <div>
                <span className="text-[10px] font-black text-finora-600 uppercase tracking-widest mb-1 block">
                  EDIÇÃO
                </span>
                <h2 className="text-xl font-black text-text">Editar Evento</h2>
                <p className="text-sm text-text-2 mt-1">
                  Altere as informações básicas e o status deste evento.
                </p>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-[#EEF1F5] hover:bg-line-strong flex items-center justify-center text-text-2 hover:text-text transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Status
                </label>
                <select
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 appearance-none"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="DRAFT">Rascunho (DRAFT)</option>
                  <option value="ACTIVE">Ativo (ACTIVE)</option>
                  <option value="PAUSED">Pausado (PAUSED)</option>
                  <option value="CLOSED">Encerrado (CLOSED)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Slug (URL amigável)
                </label>
                <input
                  type="text"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text font-mono text-sm focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
                <small className="text-xs text-text-2 block">
                  Usado em URLs de estande. Cuidado ao alterar durante o evento.
                </small>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes sobre o evento..."
                />
              </div>

              {settingsLoaded ? (
                <EventSettingsFields value={settings} onChange={setSettings} />
              ) : (
                <div className="h-40 animate-pulse rounded-xl bg-paper" />
              )}

              {error && (
                <div className="p-4 rounded-xl bg-[#FDE8EC] border border-[#F5C2CD] text-[#A3112F] text-sm font-bold text-center">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                className="px-5 py-2.5 rounded-full font-bold text-text-2 hover:text-text hover:bg-[#EEF1F5] transition-colors"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="px-6 py-2.5 rounded-full font-bold text-white bg-finora-600 hover:bg-finora-700 transition-all flex items-center gap-2 disabled:opacity-50"
                disabled={saving || !settingsLoaded}
                onClick={handleSave}
              >
                {saving ? (
                  <><LoaderCircle size={16} className="animate-spin" /> Salvando...</>
                ) : (
                  <><Check size={16} /> Salvar Alterações</>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
