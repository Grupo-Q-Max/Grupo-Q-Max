"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UserCheck,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Sparkles,
  ShieldAlert,
  LoaderCircle,
  Search,
} from "lucide-react";
import { fetchAdminProxy } from "@/lib/api-client";
import { useRouter } from "next/navigation";

type WhitelistItem = {
  id: string;
  identifier: string;
  note?: string;
  created_at: string;
};

type Props = {
  eventId: number;
};

export default function FraudWhitelistControl({ eventId }: Props) {
  const router = useRouter();

  const [whitelist, setWhitelist] = useState<WhitelistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadWhitelist = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminProxy(`/fraud-rules/event/${eventId}/whitelist`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setWhitelist(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadWhitelist();
  }, [loadWhitelist]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Informe um CPF, Telefone, E-mail ou Nome para isenção.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/fraud-rules/event/${eventId}/whitelist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          note: note.trim() || "Usuário de Teste / Isenção Antifraude",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Erro ao adicionar usuário de teste.");
      }

      setSuccess(`"${identifier.trim()}" adicionado com sucesso! Cadastros e giros ilimitados liberados.`);
      setIdentifier("");
      setNote("");
      await loadWhitelist();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(itemId: string, name: string) {
    if (!confirm(`Remover a isenção de antifraude de "${name}"?`)) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetchAdminProxy(`/fraud-rules/event/${eventId}/whitelist/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Erro ao remover usuário da lista de isenção.");
      }

      setSuccess("Isenção removida com sucesso!");
      await loadWhitelist();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao remover.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-8 rounded-3xl bg-surface border border-line-strong p-6 sm:p-8 space-y-6 shadow-sm">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-2">
            <FlaskConical size={14} className="text-amber-400 animate-pulse" />
            <span>MODO DE TESTES E HOMOLOGAÇÃO</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-text flex items-center gap-2.5">
            <UserCheck size={24} className="text-emerald-400" />
            <span>Usuários de Teste (Isenção de Antifraude / Giros Ilimitados)</span>
          </h3>
          <p className="text-xs sm:text-sm text-text-2 font-medium mt-1">
            Cadastre CPFs, Telefones, E-mails ou Nomes para permitir múltiplos cadastros e giros ilimitados na roleta sem bloqueio por regras de duplicidade.
          </p>
        </div>

        <span className="self-start sm:self-center px-4 py-1.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-xs shrink-0 flex items-center gap-1.5">
          <Sparkles size={14} />
          <span>{whitelist.length} {whitelist.length === 1 ? "isenção ativa" : "isenções ativas"}</span>
        </span>
      </div>

      {/* Toast Feedback */}
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-sm font-bold animate-in fade-in">
          <AlertCircle size={20} className="text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulário de Adição */}
      <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-paper p-5 rounded-2xl border border-line-strong">
        <div className="md:col-span-5">
          <label className="block text-xs font-bold text-text mb-1.5">
            CPF, Telefone, E-mail ou Nome de Teste <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Ex: 123.456.789-00 ou (11) 99999-9999"
            className="w-full px-4 py-3 rounded-xl bg-surface border border-line-strong text-text placeholder:text-[#8792A3] font-medium text-sm focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="md:col-span-4">
          <label className="block text-xs font-bold text-text mb-1.5">
            Nota / Identificação da Isenção (Opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex: Celular da equipe Finora no Estande"
            className="w-full px-4 py-3 rounded-xl bg-surface border border-line-strong text-text placeholder:text-[#8792A3] font-medium text-sm focus:outline-none focus:border-cyan-500 transition"
          />
        </div>

        <div className="md:col-span-3 flex items-end">
          <button
            type="submit"
            disabled={saving || !identifier.trim()}
            className="w-full py-3 px-4 rounded-xl bg-finora-600 hover:bg-finora-700 text-white font-black text-xs sm:text-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}
            <span>+ Liberar Giros Ilimitados</span>
          </button>
        </div>
      </form>

      {/* Lista de Usuários de Teste Cadastrados */}
      <div>
        <h4 className="text-sm font-bold text-text uppercase tracking-wider mb-3">
          Usuários com Isenção de Antifraude Autorizada ({whitelist.length})
        </h4>

        {loading ? (
          <div className="py-8 text-center text-text-2 flex items-center justify-center gap-2">
            <LoaderCircle size={20} className="animate-spin text-emerald-400" />
            <span className="text-sm font-medium">Carregando lista de isenção...</span>
          </div>
        ) : whitelist.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-line-strong rounded-2xl bg-paper">
            <ShieldAlert size={36} className="mx-auto text-text-2 mb-2 opacity-60" />
            <p className="text-sm font-bold text-text">Nenhum número ou CPF liberado no momento</p>
            <p className="text-xs text-text-2 mt-1 max-w-sm mx-auto">
              Utilize o formulário acima para adicionar um número, CPF ou e-mail com permissão especial de cadastros múltiplos.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {whitelist.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 rounded-2xl bg-paper border border-line-strong hover:border-emerald-500/40 transition"
              >
                <div className="min-w-0 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs shrink-0">
                    LIB
                  </span>
                  <div className="min-w-0">
                    <h5 className="font-black text-text text-sm sm:text-base truncate tracking-wide">
                      {item.identifier}
                    </h5>
                    <p className="text-xs text-text-2 font-medium truncate flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">{item.note || "Isenção Antifraude Ativa"}</span>
                      <span>•</span>
                      <span>
                        {new Date(item.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(item.id, item.identifier)}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shrink-0"
                  title="Remover Isenção de Antifraude"
                >
                  <Trash2 size={15} />
                  <span>Remover Isenção</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
