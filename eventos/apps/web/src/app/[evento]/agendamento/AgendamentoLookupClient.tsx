"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle, Phone, Search, Sparkles } from "lucide-react";
import VipScheduler from "@/components/VipScheduler";
import { getApiBaseUrl } from "@/lib/api-client";

type Props = {
  eventId: number;
  eventSlug: string;
};

export default function AgendamentoLookupClient({ eventId, eventSlug }: Props) {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<number | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const clean = identifier.trim();
    if (!clean) {
      setError("Por favor, informe seu telefone ou CPF.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Tenta validar/buscar por telefone ou identificador
      const res = await fetch(`${getApiBaseUrl()}/participants/validate-whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: clean }),
      });

      if (res.ok) {
        const data = await res.json();
        const foundId = data.participant_id || data.participant?.id || data.id;
        if (foundId) {
          setParticipantId(foundId);
          return;
        }
      }

      // 2. Se não encontrou por validate-whatsapp, busca na fila pendente
      const queueRes = await fetch(`${getApiBaseUrl()}/participants/pending-draws?eventId=${eventId}&search=${encodeURIComponent(clean)}`);
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        const list = Array.isArray(queueData) ? queueData : queueData?.participants || [];
        if (list.length > 0 && list[0].participantId) {
          setParticipantId(list[0].participantId);
          return;
        }
      }

      setError("Participação não encontrada. Verifique se o telefone ou CPF foi o mesmo do cadastro.");
    } catch {
      setError("Não foi possível buscar seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (participantId) {
    return <VipScheduler eventId={eventId} participantId={participantId} />;
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-8 pb-10">
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-ink-950/90 p-5.5 text-ink-text shadow-xl">
        <span className="font-mono text-xs font-bold tracking-[0.1em] text-accent uppercase flex items-center gap-1.5">
          <Sparkles size={14} /> LIBERAÇÃO DA ROLETA VIP
        </span>
        <h1 className="font-display text-[26px] sm:text-[30px] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
          Agendamento VIP com Nosso CEO
        </h1>
        <p className="text-[14px] leading-relaxed text-slate-300">
          Informe seu telefone (WhatsApp) cadastrado no evento para localizar sua participação e agendar a reunião que destrava a <strong>Roleta VIP</strong>.
        </p>
      </div>

      <form onSubmit={handleLookup} className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="identifier" className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Telefone / WhatsApp ou CPF
          </label>
          <div className="relative flex items-center">
            <Phone className="absolute left-3.5 size-5 text-slate-400" />
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="(11) 99999-9999 ou CPF"
              className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-3.5 pl-11 pr-4 text-white placeholder-slate-500 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent text-base"
              autoFocus
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-400">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-black text-ink-950 shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <LoaderCircle size={20} className="animate-spin text-ink-950" />
              <span>Localizando participante…</span>
            </>
          ) : (
            <>
              <span>Continuar para Agendamento</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}

