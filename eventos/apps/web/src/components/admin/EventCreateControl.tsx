"use client";

import { CalendarPlus, Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import EventSettingsFields, { DEFAULT_EVENT_SETTINGS, settingsToApi, type EventSettings } from "./EventSettingsFields";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getAdminProxyUrl } from "@/lib/api-client";

export default function EventCreateControl() {
  const router = useRouter();
  const API_URL = getAdminProxyUrl();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_EVENT_SETTINGS);

  function resetForm() {
    setName("");
    setSlug("");
    setDescription("");
    setSettings(DEFAULT_EVENT_SETTINGS);
    setError(null);
  }

  // Helper to auto-generate slug from name
  function handleNameChange(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9\s-]/g, "")    // Remove special chars
        .trim()
        .replace(/\s+/g, "-")            // Replace spaces with dash
    );
  }

  async function handleSave() {
    setError(null);

    if (!name.trim() || !slug.trim()) {
      setError("O nome e o slug são obrigatórios.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || undefined,
          status: "DRAFT",
          participationEnabled: false,
          ...settingsToApi(settings),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          Array.isArray(result?.message)
            ? result.message.join(" ")
            : result?.message || "Não foi possível criar o evento.",
        );
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar evento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-2 bg-finora-600 hover:bg-finora-700 px-4 py-2.5 rounded-full text-white text-xs font-bold transition-all border border-cyan-500/30"
        onClick={() => {
          resetForm();
          setOpen(true);
        }}
      >
        <CalendarPlus size={16} />
        <span>Novo Evento</span>
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
                  CRIAR
                </span>
                <h2 className="text-xl font-black text-text">Novo Evento</h2>
                <p className="text-sm text-text-2 mt-1">
                  Cadastre um novo evento ou congresso corporativo.
                </p>
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-surface hover:bg-line-strong flex items-center justify-center text-text-2 hover:text-text transition-colors"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Nome do Evento
                </label>
                <input
                  type="text"
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Finora Experience SP"
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
                  placeholder="Ex: finora-experience-sp"
                />
                <small className="text-xs text-text-2 block">
                  Endereço do evento: <code className="text-finora-600">/finora-experience/{slug || "slug"}</code>
                </small>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-text-2 uppercase tracking-wider block">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-text text-sm focus:outline-none focus:border-finora-600 focus:ring-1 focus:ring-finora-600 resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes internos sobre o evento..."
                />
              </div>

              <EventSettingsFields value={settings} onChange={setSettings} showIntegrations={false} />

              {error && (
                <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm font-bold text-center">
                  {error}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-line bg-paper flex items-center justify-end gap-3 shrink-0">
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
                className="px-6 py-2.5 rounded-full font-bold text-white bg-finora-600 hover:bg-finora-700 transition-all flex items-center gap-2 disabled:opacity-50"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? (
                  <><LoaderCircle size={16} className="animate-spin" /> Criando...</>
                ) : (
                  <><Check size={16} /> Confirmar Criação</>
                )}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
